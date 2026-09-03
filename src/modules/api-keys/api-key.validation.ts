import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z
    .string({
      required_error: "API Key name is required",
    })
    .trim()
    .min(1, "API Key name cannot be empty")
    .max(100, "API Key name is too long"),
  expiresAt: z
    .string()
    .datetime({ message: "Invalid ISO datetime format for expiration" })
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message: "API Key expiration must be in the future",
    })
    .optional()
    .nullable(),
});

export const updateApiKeyStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "API Key status is required",
    invalid_type_error: "API Key status must be a boolean",
  }),
});
