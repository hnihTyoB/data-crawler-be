import { WebhookConfig } from '@prisma/client';
import { WebhookRepository } from './webhook.repository';
import { encrypt } from './webhook-crypto.helper';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class WebhookConfigService {
  private readonly repository = new WebhookRepository();

  async create(
    userId: string,
    url: string,
    plainSecret: string,
    events: string[],
  ): Promise<Omit<WebhookConfig, 'encryptedSecret'>> {
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

  async list(userId: string): Promise<Omit<WebhookConfig, 'encryptedSecret'>[]> {
    const configs = await this.repository.listConfigsByUser(userId);
    return configs.map(({ encryptedSecret: _, ...rest }) => rest);
  }

  async delete(configId: string, userId: string): Promise<Omit<WebhookConfig, 'encryptedSecret'>> {
    const config = await this.repository.findConfigById(configId);

    if (!config || config.userId !== userId) {
      throw new AppError('Webhook configuration not found', 404, ERROR_CODE.WEBHOOK_CONFIG_NOT_FOUND);
    }

    const deleted = await this.repository.deleteConfig(configId);
    const { encryptedSecret: _, ...rest } = deleted;
    return rest;
  }
}
