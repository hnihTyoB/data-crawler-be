import { WebhookConfigService } from "../webhook-config.service";
import { WebhookRepository } from "../webhook.repository";
import { WebhookDeliveryService } from "../webhook-delivery.service";

jest.mock("../webhook.repository");
jest.mock("../webhook-delivery.service");
jest.mock("../../../queues/webhook.queue", () => ({
  webhookQueue: {
    add: jest.fn().mockResolvedValue({ id: "wh-job-1" }),
  },
}));
jest.mock("../webhook-crypto.helper", () => ({
  encrypt: jest.fn((val) => `enc_${val}`),
  decrypt: jest.fn((val) => `dec_${val}`),
  signPayload: jest.fn(() => "mock_signature"),
}));

describe("WebhookConfigService update and test", () => {
  const mockConfig = {
    id: "config-1",
    userId: "user-1",
    url: "https://webhook.site/test",
    encryptedSecret: "enc_secret1234567890",
    events: ["job.completed"],
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates webhook configuration fields", async () => {
    const service = new WebhookConfigService();
    (WebhookRepository.prototype.findConfigById as jest.Mock).mockResolvedValue(
      mockConfig,
    );
    (WebhookRepository.prototype.updateConfig as jest.Mock).mockResolvedValue({
      ...mockConfig,
      url: "https://webhook.site/updated",
      events: ["job.completed", "job.failed"],
    });

    const result = await service.update("config-1", "user-1", {
      url: "https://webhook.site/updated",
      events: ["job.completed", "job.failed"],
    });

    expect(result.url).toBe("https://webhook.site/updated");
    expect(result.events).toEqual(["job.completed", "job.failed"]);
    expect(WebhookRepository.prototype.updateConfig).toHaveBeenCalledWith(
      "config-1",
      {
        url: "https://webhook.site/updated",
        events: ["job.completed", "job.failed"],
      },
    );
  });

  it("creates delivery and sends ping test payload", async () => {
    const service = new WebhookConfigService();
    (WebhookRepository.prototype.findConfigById as jest.Mock).mockResolvedValue(
      mockConfig,
    );
    (WebhookRepository.prototype.createDelivery as jest.Mock).mockResolvedValue(
      {
        id: "delivery-test-1",
        webhookConfigId: "config-1",
        crawlJobId: "00000000-0000-0000-0000-000000000000",
        event: "test.ping",
        status: "PENDING",
      },
    );
    (WebhookDeliveryService.prototype.send as jest.Mock).mockResolvedValue(
      undefined,
    );
    (
      WebhookRepository.prototype.findDeliveryById as jest.Mock
    ).mockResolvedValue({
      id: "delivery-test-1",
      event: "test.ping",
      status: "SUCCESS",
      statusCode: 200,
    });

    const result = await service.test("config-1", "user-1");

    expect(result?.status).toBe("SUCCESS");
    expect(result?.statusCode).toBe(200);
    expect(WebhookRepository.prototype.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookConfigId: "config-1",
        event: "test.ping",
      }),
    );
  });
});
