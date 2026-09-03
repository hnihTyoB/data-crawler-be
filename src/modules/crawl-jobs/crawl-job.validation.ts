import { z } from "zod";
import { EXPORT_TYPE } from "../../common/constants/export-type.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { CRAWL_MODE } from "../../common/constants/crawl-mode.constant";

export const createCrawlJobSchema = z
  .object({
    startUrl: z.string().url("Invalid URL format").optional(),
    mode: z.nativeEnum(CRAWL_MODE).optional(),
    maxPages: z.number().int().min(1).max(1000).optional(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    urls: z
      .array(z.string().trim().url("Invalid URL in urls list"))
      .max(1000, "urls array cannot exceed 1000 items")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === CRAWL_MODE.URL_LIST) {
      // Fix #7: max already on array, but check empty
      if (!data.urls || data.urls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "urls is required and must not be empty when mode is URL_LIST",
          path: ["urls"],
        });
      }
      // Fix #8: reject startUrl when mode is URL_LIST
      if (data.startUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "startUrl must not be provided when mode is URL_LIST — use urls[] instead",
          path: ["startUrl"],
        });
      }
    } else {
      if (!data.startUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "startUrl is required when mode is not URL_LIST",
          path: ["startUrl"],
        });
      }
    }
  });

export const createExportSchema = z.object({
  exportType: z.nativeEnum(EXPORT_TYPE),
});

export const listCrawlJobsQuerySchema = z.object({
  status: z.nativeEnum(JOB_STATUS).optional(),
  mode: z.nativeEnum(CRAWL_MODE).optional(),
  search: z.string().trim().optional(),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "startUrl",
      "status",
      "mode",
      "totalPages",
    ])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
