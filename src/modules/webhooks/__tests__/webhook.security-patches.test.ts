import {
  signPayload,
  verifySignature,
  encrypt,
} from "../webhook-crypto.helper";
import {
  createWebhookConfigSchema,
  updateWebhookConfigSchema,
} from "../webhook.validation";
import { WebhookConfigService } from "../webhook-config.service";
import { WebhookDeliveryService } from "../webhook-delivery.service";
import { WebhookRepository } from "../webhook.repository";
import * as urlHelper from "../../../common/helpers/url.helper";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));
jest.mock("../webhook.repository");
jest.mock("../../../common/helpers/url.helper");
jest.mock("../../../queues/webhook.queue", () => ({
  webhookQueue: {
    add: jest.fn().mockResolvedValue({ id: "webhook-job-1" }),
  },
}));

describe("Webhook Security Patches (SEC-08, SEC-21, SEC-22, SEC-23)", () => {
  const secret = "test-secret-key-1234567890123456";
  const body = JSON.stringify({ event: "job.completed", data: { id: "job-1" } });

  describe("SEC-08 & SEC-21: Webhook HMAC Signature & Replay Prevention", () => {
    it("signs and verifies payload with timestamp binding (SEC-08)", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const signature = signPayload(secret, body, nowSeconds);

      // Verify fresh signature
      expect(verifySignature(secret, body, signature, nowSeconds, 300)).toBe(true);

      // Replay attack after 301 seconds must be rejected
      const pastSeconds = nowSeconds - 301;
      const replayedSig = signPayload(secret, body, pastSeconds);
      expect(verifySignature(secret, body, replayedSig, pastSeconds, 300)).toBe(false);

      // Tampered timestamp must be rejected
      expect(verifySignature(secret, body, signature, nowSeconds + 10, 300)).toBe(false);
    });

    it("handles both 'sha256=' prefixed and raw hex signatures (SEC-21)", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const rawHexSignature = signPayload(secret, body, nowSeconds);
      const prefixedSignature = `sha256=${rawHexSignature}`;

      // Raw hex
      expect(verifySignature(secret, body, rawHexSignature, nowSeconds)).toBe(true);

      // Prefixed with sha256= (as transmitted in X-Webhook-Signature)
      expect(verifySignature(secret, body, prefixedSignature, nowSeconds)).toBe(true);

      // Invalid signature
      expect(
        verifySignature(
          secret,
          body,
          "sha256=0000000000000000000000000000000000000000000000000000000000000000",
          nowSeconds,
        ),
      ).toBe(false);
    });
  });

  describe("SEC-22: Webhook Transport Security (HTTPS Enforced)", () => {
    const originalEnforce = process.env.ENFORCE_HTTPS_WEBHOOKS;

    afterEach(() => {
      process.env.ENFORCE_HTTPS_WEBHOOKS = originalEnforce;
    });

    it("rejects cleartext http:// URLs when HTTPS enforcement is active", () => {
      process.env.ENFORCE_HTTPS_WEBHOOKS = "true";

      const validResult = createWebhookConfigSchema.safeParse({
        url: "https://consumer.example.com/webhook",
        secret: "1234567890123456",
        events: ["job.completed"],
      });
      expect(validResult.success).toBe(true);

      const invalidResult = createWebhookConfigSchema.safeParse({
        url: "http://consumer.example.com/webhook",
        secret: "1234567890123456",
        events: ["job.completed"],
      });
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error.issues[0].message).toContain("HTTPS");
      }
    });

    it("WebhookConfigService.create rejects cleartext http:// when HTTPS enforcement is active", async () => {
      process.env.ENFORCE_HTTPS_WEBHOOKS = "true";
      const service = new WebhookConfigService();

      await expect(
        service.create(
          "user-1",
          "http://consumer.example.com/webhook",
          "1234567890123456",
          ["job.completed"],
        ),
      ).rejects.toThrow("HTTPS");
    });
  });

  describe("SEC-23: Error Sanitization to Prevent Port Scanning / Banner Grabbing", () => {
    let mockWebhookRepo: jest.Mocked<WebhookRepository>;

    beforeEach(() => {
      jest.clearAllMocks();
      mockWebhookRepo = {
        findConfigById: jest.fn(),
        createDelivery: jest.fn(),
        findDeliveryById: jest.fn(),
        updateDelivery: jest.fn(),
      } as any;
      (WebhookRepository as jest.Mock).mockReturnValue(mockWebhookRepo);
    });

    it("sanitizes low-level socket errors in WebhookDeliveryService.send", async () => {
      const deliveryService = new WebhookDeliveryService();
      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-1",
        event: "test.ping",
        payload: { test: true },
        webhookConfig: {
          url: "https://webhook.site/callback",
          encryptedSecret: encrypt("my-secret-12345678"),
        },
      } as any);

      (urlHelper.validateUrlAsync as jest.Mock).mockResolvedValue(undefined);
      (urlHelper.getSecureAxios as jest.Mock).mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:22")),
      });

      await expect(deliveryService.send("delivery-1", 1)).rejects.toThrow();

      // Ensure error saved to DB does not leak IP, port, or raw socket banner
      expect(mockWebhookRepo.updateDelivery).toHaveBeenCalledWith(
        "delivery-1",
        expect.objectContaining({
          errorMessage: "Delivery failed: Target server unreachable or rejected connection",
        }),
      );
    });

    it("sanitizes Parse Error: Invalid character in status line (SSH banner grab)", async () => {
      const deliveryService = new WebhookDeliveryService();
      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-2",
        event: "test.ping",
        payload: { test: true },
        webhookConfig: {
          url: "https://webhook.site/callback",
          encryptedSecret: encrypt("my-secret-12345678"),
        },
      } as any);

      (urlHelper.validateUrlAsync as jest.Mock).mockResolvedValue(undefined);
      (urlHelper.getSecureAxios as jest.Mock).mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error("Parse Error: Invalid character in status line")),
      });

      await expect(deliveryService.send("delivery-2", 1)).rejects.toThrow();

      expect(mockWebhookRepo.updateDelivery).toHaveBeenCalledWith(
        "delivery-2",
        expect.objectContaining({
          errorMessage: "Delivery failed: Target server unreachable or rejected connection",
        }),
      );
    });

    it("sanitizes errorMessage in WebhookConfigService.test return payload", async () => {
      const configService = new WebhookConfigService();
      mockWebhookRepo.findConfigById.mockResolvedValue({
        id: "config-1",
        userId: "user-1",
        url: "https://webhook.site/test",
      } as any);

      mockWebhookRepo.createDelivery.mockResolvedValue({
        id: "delivery-test-1",
        status: "PENDING",
      } as any);

      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-test-1",
        status: "FAILED",
        errorMessage: "connect ECONNREFUSED 10.0.0.5:6379",
        responseBody: "Redis banner text",
      } as any);

      const result = await configService.test("config-1", "user-1");

      expect(result?.errorMessage).toBe(
        "Delivery failed: Target server unreachable or rejected connection",
      );
      expect(result?.responseBody).toBe("[REDACTED]");
    });
  });
});
