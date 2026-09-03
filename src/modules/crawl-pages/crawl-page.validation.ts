import { z } from "zod";
import { CRAWL_PAGE_STATUS } from "../../common/constants/crawl-page-status.constant";

const parseBooleanQuery = (val: unknown) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === "true" || val === true || val === "1") return true;
  if (val === "false" || val === false || val === "0") return false;
  return undefined;
};

const parseNumberQuery = (val: unknown) => {
  if (val === undefined || val === null || val === "") return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

export const crawlPageQuerySchema = z.object({
  status: z.nativeEnum(CRAWL_PAGE_STATUS).optional(),
  statusCode: z.preprocess(parseNumberQuery, z.number().int().optional()),
  search: z.string().trim().optional(),

  dataQualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),
  minDataQualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),
  maxDataQualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),
  qualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),
  minQualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),
  maxQualityScore: z.preprocess(
    parseNumberQuery,
    z.number().min(0).max(100).optional(),
  ),

  hasImages: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  hasLinks: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  hasTables: z.preprocess(parseBooleanQuery, z.boolean().optional()),

  contentLength: z.preprocess(parseNumberQuery, z.number().min(0).optional()),
  minContentLength: z.preprocess(
    parseNumberQuery,
    z.number().min(0).optional(),
  ),
  maxContentLength: z.preprocess(
    parseNumberQuery,
    z.number().min(0).optional(),
  ),
  wordCount: z.preprocess(parseNumberQuery, z.number().min(0).optional()),
  minWordCount: z.preprocess(parseNumberQuery, z.number().min(0).optional()),
  maxWordCount: z.preprocess(parseNumberQuery, z.number().min(0).optional()),

  page: z.preprocess(parseNumberQuery, z.number().int().min(1).default(1)),
  limit: z.preprocess(
    parseNumberQuery,
    z.number().int().min(1).max(100).default(20),
  ),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "url",
      "title",
      "statusCode",
      "status",
      "crawledAt",
      "dataQualityScore",
      "wordCount",
    ])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
  preview: z.preprocess(parseBooleanQuery, z.boolean().optional()),
});

export type CrawlPageQueryInput = z.infer<typeof crawlPageQuerySchema>;
