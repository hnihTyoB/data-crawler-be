import { z } from 'zod';

export const createCrawlJobSchema = z.object({
  startUrl: z.string().url('Invalid URL format').optional(),
  mode: z.enum(['SCRAPE', 'CRAWL', 'SITEMAP', 'URL_LIST']).optional(),
  maxPages: z.number().int().min(1).max(1000).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  urls: z.array(
    z.string().trim().url('Invalid URL in urls list')
  ).max(1000, 'urls array cannot exceed 1000 items').optional(),
}).superRefine((data, ctx) => {
  if (data.mode === 'URL_LIST') {
    // Fix #7: max already on array, but check empty
    if (!data.urls || data.urls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'urls is required and must not be empty when mode is URL_LIST',
        path: ['urls'],
      });
    }
    // Fix #8: reject startUrl when mode is URL_LIST
    if (data.startUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startUrl must not be provided when mode is URL_LIST — use urls[] instead',
        path: ['startUrl'],
      });
    }
  } else {
    if (!data.startUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startUrl is required when mode is not URL_LIST',
        path: ['startUrl'],
      });
    }
  }
});

export const createExportSchema = z.object({
  exportType: z.enum(['JSON', 'CSV', 'XLSX', 'MARKDOWN', 'ZIP']),
});