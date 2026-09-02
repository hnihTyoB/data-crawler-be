import { z } from 'zod';

export const createWebhookConfigSchema = z.object({
  url: z.string({
    required_error: 'Webhook URL is required',
  }).url('Invalid Webhook URL format'),
  secret: z.string({
    required_error: 'Webhook HMAC signing secret is required',
  }).min(16, 'Signing secret must be at least 16 characters long for security')
    .max(128, 'Signing secret is too long'),
  events: z.array(
    z.enum(['job.completed', 'job.failed'])
  ).min(1, 'At least one event must be selected for notifications'),
});
