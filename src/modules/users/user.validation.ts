import { z } from "zod";
import { ROLES } from "../../common/constants/role.constant";

export const createUserSchema = z.object({
  email: z.string().email("Email không đúng định dạng."),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
  fullName: z.string().optional(),
  avatarUrl: z
    .string()
    .url("Avatar URL không đúng định dạng.")
    .or(z.literal(""))
    .optional(),
  role: z.nativeEnum(ROLES).optional(),
  maxPagesLimit: z.number().int().min(1).max(100000).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).max(10000).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).max(100).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email("Email không đúng định dạng.").optional(),
  fullName: z.string().optional(),
  avatarUrl: z
    .string()
    .url("Avatar URL không đúng định dạng.")
    .or(z.literal(""))
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(ROLES).optional(),
  maxPagesLimit: z.number().int().min(1).max(100000).optional(),
  maxJobsPerDayLimit: z.number().int().min(1).max(10000).optional(),
  maxConcurrentJobsLimit: z.number().int().min(1).max(100).optional(),
});

export const listUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(ROLES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid("Invalid role ID format"), {
    required_error: "roleIds array is required",
  }),
});

export const userParamsSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export const userRoleAssignmentParamsSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  roleId: z.string().uuid("Invalid role ID format"),
});
