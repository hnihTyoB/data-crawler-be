export const WEBHOOK_DELIVERY_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type WebhookDeliveryStatus = keyof typeof WEBHOOK_DELIVERY_STATUS;

export const WEBHOOK_EVENT = {
  JOB_COMPLETED: "job.completed",
  JOB_FAILED: "job.failed",
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENT)[keyof typeof WEBHOOK_EVENT];
