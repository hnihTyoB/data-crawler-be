import { prisma } from '../../database/prisma.client';
import { WebhookConfig, WebhookDelivery, Prisma } from '@prisma/client';

export class WebhookRepository {
  createConfig(data: {
    userId: string;
    url: string;
    encryptedSecret: string;
    events: string[];
  }): Promise<WebhookConfig> {
    return prisma.webhookConfig.create({
      data: {
        userId: data.userId,
        url: data.url,
        encryptedSecret: data.encryptedSecret,
        events: data.events,
      },
    });
  }

  listConfigsByUser(userId: string): Promise<WebhookConfig[]> {
    return prisma.webhookConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findConfigById(id: string): Promise<WebhookConfig | null> {
    return prisma.webhookConfig.findUnique({
      where: { id },
    });
  }

  deleteConfig(id: string): Promise<WebhookConfig> {
    return prisma.webhookConfig.delete({
      where: { id },
    });
  }

  findActiveConfigsByEvent(userId: string, event: string): Promise<WebhookConfig[]> {
    return prisma.webhookConfig.findMany({
      where: {
        userId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });
  }

  createDelivery(data: {
    webhookConfigId: string;
    crawlJobId: string;
    event: string;
    payload: any;
    status: string;
    attempt: number;
  }): Promise<WebhookDelivery> {
    return prisma.webhookDelivery.create({
      data: {
        webhookConfigId: data.webhookConfigId,
        crawlJobId: data.crawlJobId,
        event: data.event,
        payload: data.payload,
        status: data.status,
        attempt: data.attempt,
      },
    });
  }

  findDeliveryById(id: string) {
    return prisma.webhookDelivery.findUnique({
      where: { id },
      include: { webhookConfig: true },
    });
  }

  updateDelivery(id: string, data: Prisma.WebhookDeliveryUpdateInput): Promise<WebhookDelivery> {
    return prisma.webhookDelivery.update({
      where: { id },
      data,
    });
  }

  listDeliveries(
    userId: string,
    query: { jobId?: string; status?: string },
  ) {
    const where: Prisma.WebhookDeliveryWhereInput = {
      webhookConfig: {
        userId,
      },
    };

    if (query.jobId) {
      where.crawlJobId = query.jobId;
    }

    if (query.status) {
      where.status = query.status;
    }

    return prisma.webhookDelivery.findMany({
      where,
      include: {
        webhookConfig: {
          select: {
            url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
