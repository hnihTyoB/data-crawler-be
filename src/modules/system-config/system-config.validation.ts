import { z } from "zod";
import { SYSTEM_CONFIG_CATEGORY } from "../../common/constants/system-config.constant";

export const createSystemConfigSchema = z.object({
  key: z
    .string({ required_error: "Khóa cấu hình là bắt buộc" })
    .min(2, "Khóa cấu hình phải có ít nhất 2 ký tự")
    .max(100, "Khóa cấu hình tối đa 100 ký tự")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Khóa cấu hình chỉ được chứa chữ cái, chữ số, dấu chấm (.), gạch dưới (_) và gạch ngang (-)",
    ),
  value: z
    .any()
    .refine((val) => val !== undefined, {
      message: "Giá trị cấu hình không được để trống",
    }),
  description: z.string().max(500, "Mô tả tối đa 500 ký tự").optional().nullable(),
  category: z
    .nativeEnum(SYSTEM_CONFIG_CATEGORY)
    .optional()
    .default(SYSTEM_CONFIG_CATEGORY.GENERAL),
  isPublic: z.boolean().optional().default(false),
});

export const updateSystemConfigSchema = z
  .object({
    value: z.any().optional(),
    description: z.string().max(500, "Mô tả tối đa 500 ký tự").optional().nullable(),
    category: z.nativeEnum(SYSTEM_CONFIG_CATEGORY).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.value !== undefined ||
      data.description !== undefined ||
      data.category !== undefined ||
      data.isPublic !== undefined,
    {
      message: "Phải cung cấp ít nhất một trường để cập nhật",
    },
  );

export const systemConfigKeyParamSchema = z.object({
  key: z.string().min(1, "Khóa cấu hình không được để trống"),
});

export const systemConfigQuerySchema = z.object({
  category: z.nativeEnum(SYSTEM_CONFIG_CATEGORY).optional(),
  search: z.string().optional(),
  isPublic: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional(),
  page: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return 1;
      const parsed = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return 20;
      const parsed = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(parsed) || parsed < 1 ? 20 : Math.min(parsed, 100);
    }),
});
