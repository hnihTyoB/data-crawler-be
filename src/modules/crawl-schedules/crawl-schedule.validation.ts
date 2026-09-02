import { z } from 'zod';
import { isValidCronExpression } from '../../common/helpers/schedule-calculator.helper';

export const createCrawlScheduleSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150),
    startUrl: z.string().trim().url('Invalid startUrl format'),
    mode: z.enum(['SCRAPE', 'CRAWL', 'SITEMAP', 'URL_LIST']).optional().default('SCRAPE'),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional().default('DAILY'),
    cronExpression: z.string().trim().optional(),
    hour: z.number().int().min(0).max(23).optional().default(0),
    minute: z.number().int().min(0).max(59).optional().default(0),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezone: z.string().trim().optional().default('Asia/Ho_Chi_Minh'),
    maxPages: z.number().int().min(1).max(1000).optional().default(20),
    maxDepth: z.number().int().min(1).max(10).optional().default(1),
    urls: z.array(z.string().trim().url()).optional().default([]),
    isActive: z.boolean().optional().default(true),
    autoDiff: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'URL_LIST') {
      if (!data.urls || data.urls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'urls must contain at least 1 URL when mode is URL_LIST',
          path: ['urls'],
        });
      }
    }

    if (data.frequency === 'CUSTOM') {
      if (!data.cronExpression || !isValidCronExpression(data.cronExpression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid cronExpression (5-part standard cron) is required when frequency is CUSTOM',
          path: ['cronExpression'],
        });
      }
    }

    if (data.frequency === 'WEEKLY' && data.dayOfWeek === undefined) {
      data.dayOfWeek = 0; // Default to Sunday
    }

    if (data.frequency === 'MONTHLY' && data.dayOfMonth === undefined) {
      data.dayOfMonth = 1; // Default to 1st of month
    }
  });

export const updateCrawlScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    startUrl: z.string().trim().url('Invalid startUrl format').optional(),
    mode: z.enum(['SCRAPE', 'CRAWL', 'SITEMAP', 'URL_LIST']).optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
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
    if (data.frequency === 'CUSTOM' && data.cronExpression !== undefined) {
      if (!isValidCronExpression(data.cronExpression)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid cronExpression (5-part standard cron) is required when frequency is CUSTOM',
          path: ['cronExpression'],
        });
      }
    }
  });

export const crawlScheduleQuerySchema = z.object({
  search: z.string().trim().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  sortBy: z.string().optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});
