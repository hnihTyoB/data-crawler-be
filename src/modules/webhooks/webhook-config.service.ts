import { WebhookConfig } from "@prisma/client";
import { WebhookRepository } from "./webhook.repository";
import { encrypt } from "./webhook-crypto.helper";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class WebhookConfigService {
  private readonly repository = new WebhookRepository();

  async create(
    userId: string,
    url: string,
    plainSecret: string,
    events: string[],
  ): Promise<Omit<WebhookConfig, "encryptedSecret">> {
    const encryptedSecret = encrypt(plainSecret);

    const config = await this.repository.createConfig({
      userId,
      url,
      encryptedSecret,
      events,
    });

    const { encryptedSecret: _, ...rest } = config;
    return rest;
  }

  async list(
    userId: string,
  ): Promise<Omit<WebhookConfig, "encryptedSecret">[]> {
    const configs = await this.repository.listConfigsByUser(userId);
    return configs.map(({ encryptedSecret: _, ...rest }) => rest);
  }

  async delete(
    configId: string,
    userId: string,
  ): Promise<Omit<WebhookConfig, "encryptedSecret">> {
    const config = await this.repository.findConfigById(configId);

    if (!config || config.userId !== userId) {
      throw new AppError(
        "Webhook configuration not found",
        404,
        ERROR_CODE.WEBHOOK_CONFIG_NOT_FOUND,
      );
    }

    const deleted = await this.repository.deleteConfig(configId);
    const { encryptedSecret: _, ...rest } = deleted;
    return rest;
  }

  async update(
    configId: string,
    userId: string,
    data: {
      url?: string;
      secret?: string;
      events?: string[];
      isActive?: boolean;
    },
  ): Promise<Omit<WebhookConfig, "encryptedSecret">> {
    const config = await this.repository.findConfigById(configId);

    if (!config || config.userId !== userId) {
      throw new AppError(
        "Webhook configuration not found",
        404,
        ERROR_CODE.WEBHOOK_CONFIG_NOT_FOUND,
      );
    }

    const updatePayload: {
      url?: string;
      encryptedSecret?: string;
      events?: string[];
      isActive?: boolean;
    } = {};

    if (data.url !== undefined) updatePayload.url = data.url;
    if (data.secret !== undefined)
      updatePayload.encryptedSecret = encrypt(data.secret);
    if (data.events !== undefined) updatePayload.events = data.events;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const updated = await this.repository.updateConfig(configId, updatePayload);
    const { encryptedSecret: _, ...rest } = updated;
    return rest;
  }

  async test(configId: string, userId: string) {
    const config = await this.repository.findConfigById(configId);

    if (!config || config.userId !== userId) {
      throw new AppError(
        "Webhook configuration not found",
        404,
        ERROR_CODE.WEBHOOK_CONFIG_NOT_FOUND,
      );
    }

    const timestamp = new Date().toISOString();
    const payload = {
      event: "test.ping",
      timestamp,
      message: "This is a test webhook delivery from DataCrawler.",
    };

    const delivery = await this.repository.createDelivery({
      webhookConfigId: config.id,
      crawlJobId: "00000000-0000-0000-0000-000000000000",
      event: "test.ping",
      payload,
      status: "PENDING",
      attempt: 1,
    });

    const { WebhookDeliveryService } =
      await import("./webhook-delivery.service");
    const deliveryService = new WebhookDeliveryService();

    try {
      await deliveryService.send(delivery.id, 1);
    } catch {
      // delivery status & error recorded in DB by send()
    }

    return this.repository.findDeliveryById(delivery.id);
  }
}
