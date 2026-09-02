import { prisma } from '../../database/prisma.client';
import { WebhookConfig } from '@prisma/client';
import { encrypt } from './webhook-crypto.helper';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class WebhookConfigService {
  async create(
    userId: string,
    url: string,
    plainSecret: string,
    events: string[]
  ): Promise<Omit<WebhookConfig, 'encryptedSecret'>> {
    const encryptedSecret = encrypt(plainSecret);

    const config = await prisma.webhookConfig.create({
      data: {
        userId,
        url,
        encryptedSecret,
        events,
      },
    });

    const { encryptedSecret: _, ...rest } = config;
    return rest;
  }

  async list(userId: string): Promise<Omit<WebhookConfig, 'encryptedSecret'>[]> {
    const configs = await prisma.webhookConfig.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return configs.map(({ encryptedSecret, ...rest }) => rest);
  }

  async delete(configId: string, userId: string): Promise<Omit<WebhookConfig, 'encryptedSecret'>> {
    const config = await prisma.webhookConfig.findUnique({
      where: { id: configId },
    });

    if (!config || config.userId !== userId) {
      throw new AppError('Webhook configuration not found', 404, ERROR_CODE.WEBHOOK_CONFIG_NOT_FOUND);
    }

    const deleted = await prisma.webhookConfig.delete({
      where: { id: configId },
    });

    const { encryptedSecret: _, ...rest } = deleted;
    return rest;
  }
}
