import { z } from "zod";

export const crawlExportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const crawlExportParamsSchema = z.object({
  exportId: z.string().uuid("Invalid export ID format"),
});
