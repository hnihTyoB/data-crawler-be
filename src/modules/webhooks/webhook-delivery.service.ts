import { WebhookDelivery } from '@prisma/client';
import { WebhookRepository } from './webhook.repository';
import { decrypt, signPayload } from './webhook-crypto.helper';
import { webhookQueue } from '../../queues/webhook.queue';
import { getSecureAxios } from '../../common/helpers/url.helper';

export class WebhookDeliveryService {
  private readonly repository = new WebhookRepository();

  async dispatch(crawlJobId: string, userId: string, event: string, jobData: any): Promise<void> {
    try {
      const configs = await this.repository.findActiveConfigsByEvent(userId, event);

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
        const delivery = await this.repository.createDelivery({
          webhookConfigId: config.id,
          crawlJobId,
          event,
          payload: payload as any,
          status: 'PENDING',
          attempt: 1,
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
            },
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
    const delivery = await this.repository.findDeliveryById(deliveryId);

    if (!delivery) {
      throw new Error(`WebhookDelivery ${deliveryId} not found`);
    }

    await this.repository.updateDelivery(deliveryId, {
      attempt: attemptNumber,
    });

    const config = delivery.webhookConfig;
    const secret = decrypt(config.encryptedSecret);
    const payloadStr = JSON.stringify(delivery.payload);
    const signature = signPayload(secret, payloadStr);

    try {
      const response = await getSecureAxios().post(config.url, payloadStr, {
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

      await this.repository.updateDelivery(deliveryId, {
        status: 'SUCCESS',
        statusCode: response.status,
        responseBody: responseBody.substring(0, 2000), // Limit size stored in DB
        deliveredAt: new Date(),
        errorMessage: null,
      });

    } catch (error: any) {
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      const errorMessage = error.message || 'Unknown network error';

      if (error.response) {
        statusCode = error.response.status;
        responseBody = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      }

      await this.repository.updateDelivery(deliveryId, {
        statusCode,
        responseBody: responseBody ? responseBody.substring(0, 2000) : null,
        errorMessage: errorMessage.substring(0, 1000),
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
    await this.repository.updateDelivery(deliveryId, {
      status: 'FAILED',
      errorMessage: `Max attempts exhausted. Last error: ${errorReason}`.substring(0, 1000),
    });
  }

  async listDeliveries(
    userId: string,
    query: { jobId?: string; status?: string },
  ): Promise<WebhookDelivery[]> {
    return this.repository.listDeliveries(userId, query);
  }
}
