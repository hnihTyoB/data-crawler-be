import { z } from "zod";

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
    .array(z.enum(["job.completed", "job.failed"]))
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
    .array(z.enum(["job.completed", "job.failed"]))
    .min(1, "At least one event must be selected for notifications")
    .optional(),
  isActive: z.boolean().optional(),
});

export const listWebhookDeliveriesQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
