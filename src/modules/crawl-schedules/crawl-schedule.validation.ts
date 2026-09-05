import { z } from "zod";
import { isValidCronExpression } from "../../common/helpers/schedule-calculator.helper";
import { DEFAULT_TIMEZONE } from "../../common/constants/timezone.constant";
import { CRAWL_MODE } from "../../common/constants/crawl-mode.constant";
import { SCHEDULE_FREQUENCY } from "../../common/constants/schedule-frequency.constant";

export const createCrawlScheduleSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    startUrl: z.string().trim().url("Invalid startUrl format"),
    mode: z.nativeEnum(CRAWL_MODE).optional().default(CRAWL_MODE.SCRAPE),
    frequency: z
      .nativeEnum(SCHEDULE_FREQUENCY)
      .optional()
      .default(SCHEDULE_FREQUENCY.DAILY),
    cronExpression: z.string().trim().optional(),
    hour: z.number().int().min(0).max(23).optional().default(0),
    minute: z.number().int().min(0).max(59).optional().default(0),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezone: z.string().trim().optional().default(DEFAULT_TIMEZONE),
    maxPages: z.number().int().min(1).max(1000).optional().default(20),
    maxDepth: z.number().int().min(1).max(10).optional().default(1),
    urls: z.array(z.string().trim().url()).optional().default([]),
    isActive: z.boolean().optional().default(true),
    autoDiff: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.mode === CRAWL_MODE.URL_LIST) {
      if (!data.urls || data.urls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "urls must contain at least 1 URL when mode is URL_LIST",
          path: ["urls"],
        });
      }
    }

    if (data.frequency === SCHEDULE_FREQUENCY.CUSTOM) {
      if (!data.cronExpression || !isValidCronExpression(data.cronExpression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Valid cronExpression (5-part standard cron) is required when frequency is CUSTOM",
          path: ["cronExpression"],
        });
      }
    }
  });

export const updateCrawlScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    startUrl: z.string().trim().url("Invalid startUrl format").optional(),
    mode: z.nativeEnum(CRAWL_MODE).optional(),
    frequency: z.nativeEnum(SCHEDULE_FREQUENCY).optional(),
    cronExpression: z.string().trim().optional(),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezone: z.string().trim().optional(),
    maxPages: z.number().int().min(1).max(1000).optional(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    urls: z.array(z.string().trim().url()).optional(),
    isActive: z.boolean().optional(),
    autoDiff: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.frequency === SCHEDULE_FREQUENCY.CUSTOM &&
      data.cronExpression !== undefined
    ) {
      if (!isValidCronExpression(data.cronExpression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Valid cronExpression (5-part standard cron) is required when frequency is CUSTOM",
          path: ["cronExpression"],
        });
      }
    }
  });

export const crawlScheduleQuerySchema = z.object({
  search: z.string().trim().optional(),
  frequency: z.nativeEnum(SCHEDULE_FREQUENCY).optional(),
  isActive: z.preprocess((val) => {
    if (val === "true" || val === true || val === "1") return true;
    if (val === "false" || val === false || val === "0") return false;
    return undefined;
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "name",
      "frequency",
      "nextRunAt",
      "lastRunAt",
      "isActive",
    ])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const crawlScheduleHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const crawlScheduleParamsSchema = z.object({
  id: z.string().uuid("Invalid schedule ID format"),
});
