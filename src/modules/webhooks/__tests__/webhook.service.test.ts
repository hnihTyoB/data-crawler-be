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

import { WebhookConfigService } from "../webhook-config.service";
import { WebhookDeliveryService } from "../webhook-delivery.service";
import { WebhookRepository } from "../webhook.repository";
import * as urlHelper from "../../../common/helpers/url.helper";
import { webhookQueue } from "../../../queues/webhook.queue";

import { encrypt } from "../webhook-crypto.helper";

describe("Webhook Services", () => {
  let configService: WebhookConfigService;
  let deliveryService: WebhookDeliveryService;
  let mockWebhookRepo: jest.Mocked<WebhookRepository>;
  let mockSecureAxiosPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebhookRepo = {
      createConfig: jest.fn(),
      listConfigsByUser: jest.fn(),
      findConfigById: jest.fn(),
      deleteConfig: jest.fn(),
      findActiveConfigsByEvent: jest.fn(),
      createDelivery: jest.fn(),
      findDeliveryById: jest.fn(),
      updateDelivery: jest.fn(),
      listDeliveries: jest.fn(),
    } as any;

    (WebhookRepository as jest.Mock).mockReturnValue(mockWebhookRepo);

    mockSecureAxiosPost = jest
      .fn()
      .mockResolvedValue({ status: 200, data: "OK" });
    (urlHelper.getSecureAxios as jest.Mock).mockReturnValue({
      post: mockSecureAxiosPost,
    });

    configService = new WebhookConfigService();
    deliveryService = new WebhookDeliveryService();
  });

  describe("WebhookConfigService", () => {
    it("creates webhook config and strips encryptedSecret from return value", async () => {
      mockWebhookRepo.createConfig.mockResolvedValue({
        id: "config-1",
        userId: "user-1",
        url: "https://webhook.site/test",
        encryptedSecret: "enc:secret",
        events: ["job.completed"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await configService.create(
        "user-1",
        "https://webhook.site/test",
        "plain-secret-123",
        ["job.completed"],
      );

      expect(mockWebhookRepo.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          url: "https://webhook.site/test",
          events: ["job.completed"],
        }),
      );
      expect((result as any).encryptedSecret).toBeUndefined();
      expect(result.id).toBe("config-1");
    });

    it("throws 404 when deleting a non-existent or other user config", async () => {
      mockWebhookRepo.findConfigById.mockResolvedValue({
        id: "config-1",
        userId: "other-user",
      } as any);

      await expect(configService.delete("config-1", "user-1")).rejects.toThrow(
        "Webhook configuration not found",
      );
    });
  });

  describe("WebhookDeliveryService", () => {
    it("dispatches deliveries and enqueues to webhook queue", async () => {
      mockWebhookRepo.findActiveConfigsByEvent.mockResolvedValue([
        { id: "config-1", userId: "user-1" } as any,
      ]);
      mockWebhookRepo.createDelivery.mockResolvedValue({
        id: "delivery-1",
      } as any);

      await deliveryService.dispatch("job-1", "user-1", "job.completed", {
        pages: 10,
      });

      expect(mockWebhookRepo.createDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookConfigId: "config-1",
          crawlJobId: "job-1",
          event: "job.completed",
        }),
      );
      expect(webhookQueue?.add).toHaveBeenCalledWith(
        "send-webhook",
        { deliveryId: "delivery-1" },
        expect.any(Object),
      );
    });

    it("sends delivery using getSecureAxios to prevent SSRF", async () => {
      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-1",
        event: "job.completed",
        payload: { test: true },
        webhookConfig: {
          url: "https://webhook.site/callback",
          encryptedSecret: encrypt("my-secret-123"),
        },
      } as any);

      await deliveryService.send("delivery-1", 1);

      expect(urlHelper.getSecureAxios).toHaveBeenCalled();
      expect(mockSecureAxiosPost).toHaveBeenCalledWith(
        "https://webhook.site/callback",
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Webhook-Event": "job.completed",
          }),
        }),
      );
      expect(mockWebhookRepo.updateDelivery).toHaveBeenCalledWith(
        "delivery-1",
        expect.objectContaining({
          status: "SUCCESS",
          statusCode: 200,
        }),
      );
    });

    it("redelivers a failed webhook and enqueues to queue", async () => {
      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-1",
        event: "job.completed",
        webhookConfig: {
          userId: "user-1",
        },
      } as any);

      mockWebhookRepo.updateDelivery.mockResolvedValue({
        id: "delivery-1",
        status: "PENDING",
      } as any);

      const result = await deliveryService.redeliver("delivery-1", "user-1");

      expect(mockWebhookRepo.updateDelivery).toHaveBeenCalledWith(
        "delivery-1",
        expect.objectContaining({
          status: "PENDING",
          attempt: 1,
          errorMessage: null,
        }),
      );
      expect(webhookQueue?.add).toHaveBeenCalledWith(
        "send-webhook",
        { deliveryId: "delivery-1" },
        expect.any(Object),
      );
      expect(result.status).toBe("PENDING");
    });

    it("throws 404 when redelivering delivery of another user", async () => {
      mockWebhookRepo.findDeliveryById.mockResolvedValue({
        id: "delivery-1",
        webhookConfig: {
          userId: "other-user",
        },
      } as any);

      await expect(
        deliveryService.redeliver("delivery-1", "user-1"),
      ).rejects.toThrow("Webhook delivery not found");
    });
  });
});
