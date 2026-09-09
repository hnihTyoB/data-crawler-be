import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string({ required_error: "Role name is required" })
    .min(2, "Role name must be at least 2 characters")
    .max(100, "Role name must not exceed 100 characters")
    .trim(),
  slug: z
    .string({ required_error: "Role slug is required" })
    .min(2, "Role slug must be at least 2 characters")
    .max(50, "Role slug must not exceed 50 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Role slug must only contain lowercase alphanumeric characters and underscores",
    )
    .trim(),
  description: z.string().max(500).optional(),
  permissionIds: z
    .array(z.string().uuid("Invalid permission ID format"))
    .optional(),
  maxPagesLimit: z.number().int().min(1).max(100000).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).max(10000).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).max(100).optional(),
  maxPagesPerMonthLimit: z.number().int().min(1).max(1000000).nullable().optional(),
  maxJobsPerMonthLimit: z.number().int().min(1).max(100000).nullable().optional(),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(100, "Role name must not exceed 100 characters")
    .trim()
    .optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  maxPagesLimit: z.number().int().min(1).max(100000).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).max(10000).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).max(100).optional(),
  maxPagesPerMonthLimit: z.number().int().min(1).max(1000000).nullable().optional(),
  maxJobsPerMonthLimit: z.number().int().min(1).max(100000).nullable().optional(),
  syncUsersQuota: z.boolean().optional(),
});

export const resetRoleQuotaSchema = z.object({
  syncLimits: z.boolean().optional().default(false),
});

export const assignRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid("Invalid permission ID format"), {
    required_error: "permissionIds array is required",
  }),
});

export const listRolesQuerySchema = z.object({
  search: z.string().optional(),
  isSystem: z
    .preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  isActive: z
    .preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  page: z
    .preprocess(
      (val) => (val ? Number(val) : 1),
      z.number().int().min(1).default(1),
    )
    .optional(),
  limit: z
    .preprocess(
      (val) => (val ? Number(val) : 20),
      z.number().int().min(1).max(100).default(20),
    )
    .optional(),
});

export const roleParamsSchema = z.object({
  id: z.string().uuid("Invalid role ID format"),
});

export const rolePermissionParamsSchema = z.object({
  id: z.string().uuid("Invalid role ID format"),
  permissionId: z.string().uuid("Invalid permission ID format"),
});
