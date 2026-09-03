import { z } from "zod";
import {
  WEBHOOK_DELIVERY_STATUS,
  WEBHOOK_EVENT,
} from "../../common/constants/webhook.constant";

export const createWebhookConfigSchema = z.object({
  url: z
    .string({
      required_error: "Webhook URL is required",
    })
    .url("Invalid Webhook URL format"),
  secret: z
    .string({
      required_error: "Webhook HMAC signing secret is required",
    })
    .min(16, "Signing secret must be at least 16 characters long for security")
    .max(128, "Signing secret is too long"),
  events: z
    .array(z.nativeEnum(WEBHOOK_EVENT))
    .min(1, "At least one event must be selected for notifications"),
});

export const updateWebhookConfigSchema = z.object({
  url: z.string().url("Invalid Webhook URL format").optional(),
  secret: z
    .string()
    .min(16, "Signing secret must be at least 16 characters long for security")
    .max(128, "Signing secret is too long")
    .optional(),
  events: z
    .array(z.nativeEnum(WEBHOOK_EVENT))
    .min(1, "At least one event must be selected for notifications")
    .optional(),
  isActive: z.boolean().optional(),
});

export const listWebhookDeliveriesQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  status: z.nativeEnum(WEBHOOK_DELIVERY_STATUS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
