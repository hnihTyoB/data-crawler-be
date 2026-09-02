import { prisma } from '../../database/prisma.client';
import { WebhookDelivery, WebhookConfig } from '@prisma/client';
import { decrypt, signPayload } from './webhook-crypto.helper';
import { webhookQueue } from '../../queues/webhook.queue';
import axios from 'axios';

export class WebhookDeliveryService {
  async dispatch(crawlJobId: string, userId: string, event: string, jobData: any): Promise<void> {
    try {
      const configs = await prisma.webhookConfig.findMany({
        where: {
          userId,
          isActive: true,
          events: {
            has: event,
          },
        },
      });

      if (configs.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString();
      const payload = {
        event,
        timestamp,
        data: jobData,
      };

      for (const config of configs) {
        const delivery = await prisma.webhookDelivery.create({
          data: {
            webhookConfigId: config.id,
            crawlJobId,
            event,
            payload: payload as any,
            status: 'PENDING',
            attempt: 1,
          },
        });

        if (webhookQueue) {
          await webhookQueue.add(
            'send-webhook',
            { deliveryId: delivery.id },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000, // 5s, 25s, 125s
              },
            }
          );
        } else {
          console.error('[Webhook] Redis/BullMQ is not initialized. Webhook could not be enqueued.');
        }
      }
    } catch (error) {
      console.error('[Webhook Dispatch Error]:', error);
    }
  }

  async send(deliveryId: string, attemptNumber: number): Promise<void> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhookConfig: true },
    });

    if (!delivery) {
      throw new Error(`WebhookDelivery ${deliveryId} not found`);
    }

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempt: attemptNumber },
    });

    const config = delivery.webhookConfig;
    const secret = decrypt(config.encryptedSecret);
    const payloadStr = JSON.stringify(delivery.payload);
    const signature = signPayload(secret, payloadStr);

    try {
      const response = await axios.post(config.url, payloadStr, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Delivery': delivery.id,
        },
        timeout: 10000, // 10s timeout
      });

      const responseBody = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SUCCESS',
          statusCode: response.status,
          responseBody: responseBody.substring(0, 2000), // Limit size stored in DB
          deliveredAt: new Date(),
          errorMessage: null,
        },
      });

    } catch (error: any) {
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage = error.message || 'Unknown network error';

      if (error.response) {
        statusCode = error.response.status;
        responseBody = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      }

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          statusCode,
          responseBody: responseBody ? responseBody.substring(0, 2000) : null,
          errorMessage: errorMessage.substring(0, 1000),
        },
      });

      // Throw error to trigger BullMQ retry
      throw error;
    }
  }

  /**
   * Sets final status to FAILED when all retries are exhausted.
   * Called by BullMQ worker when job fails after max attempts.
   */
  async markFailed(deliveryId: string, errorReason: string): Promise<void> {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        errorMessage: `Max attempts exhausted. Last error: ${errorReason}`.substring(0, 1000),
      },
    });
  }

  async listDeliveries(
    userId: string,
    query: { jobId?: string; status?: string }
  ): Promise<WebhookDelivery[]> {
    const where: any = {
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
