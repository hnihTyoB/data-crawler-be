import * as cheerio from "cheerio";
import { ExtractionTemplateRepository } from "./extraction-template.repository";
import { ExtractionFieldDto } from "./extraction-template.dto";
import { CrawlPageRepository } from "../crawl-pages/crawl-page.repository";
import { FirecrawlPageResult } from "../firecrawl/firecrawl.dto";

const getTemplateRepository = () => new ExtractionTemplateRepository();
const getPageRepository = () => new CrawlPageRepository();

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function runSelectors(
  html: string,
  fields: ExtractionFieldDto[],
): {
  success: boolean;
  data: Record<string, string | null>;
  missingRequired: string[];
} {
  const $ = cheerio.load(html);
  const data: Record<string, string | null> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const el = $(field.selector).first();
    let value: string | null = null;
    if (el.length > 0) {
      value =
        field.attr === "innerText"
          ? el.text().trim() || null
          : (el.attr(field.attr)?.trim() ?? null);
    }
    data[field.name] = value;
    if (field.required && !value) missingRequired.push(field.name);
  }

  return { success: missingRequired.length === 0, data, missingRequired };
}

interface TemplateCacheEntry {
  value: any;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const templateCache = new Map<string, TemplateCacheEntry>();

/**
 * Xóa cache template (dùng sau khi batch kết thúc hoặc khi cập nhật template).
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Lấy template theo domain có cache trong bộ nhớ để triệt tiêu N+1 queries khi crawl.
 * Có cơ chế Bounded Cache (max 1000 domain) và TTL 10 phút chống Memory Leak (DoS/OOM).
 */
export async function getCachedTemplate(domain: string, userId?: string) {
  const now = Date.now();
  const cacheKey = `${userId || "global"}:${domain}`;
  const cached = templateCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const repository = getTemplateRepository();
  const template = userId
    ? await repository.findByUserAndDomain(userId, domain)
    : await repository.findByDomain(domain);

  // Evict oldest item if capacity reached
  if (templateCache.size >= MAX_CACHE_SIZE) {
    const firstKey = templateCache.keys().next().value;
    if (firstKey) {
      templateCache.delete(firstKey);
    }
  }

  templateCache.set(cacheKey, {
    value: template ?? null,
    expiresAt: now + CACHE_TTL_MS,
  });
  return template ?? null;
}

/**
 * Trích xuất dữ liệu cấu trúc theo template trên bộ nhớ mà không ghi DB.
 */
export async function extractStructuredDataIfTemplate(
  pageUrl: string,
  item: FirecrawlPageResult,
  userId?: string,
): Promise<{
  templateId: string;
  templateName: string;
  success: boolean;
  missingRequired: string[];
  data: Record<string, string | null>;
  extractedAt: string;
} | null> {
  const html =
    "html" in item && typeof (item as { html?: string }).html === "string"
      ? (item as { html: string }).html
      : (item.markdown ?? "");
  if (!html) return null;

  const domain = extractDomainFromUrl(pageUrl);
  if (!domain) return null;

  const template = await getCachedTemplate(domain, userId);
  if (!template) return null;

  const fields = template.fields as unknown as ExtractionFieldDto[];
  if (!fields || fields.length === 0) return null;

  const result = runSelectors(html, fields);
  return {
    templateId: template.id,
    templateName: template.name,
    success: result.success,
    missingRequired: result.missingRequired,
    data: result.data,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Checks if an ExtractionTemplate exists for the page's domain.
 * If found, runs CSS selector extraction against the page's raw HTML.
 * Saves result to CrawlPage.extractedData.
 */
export async function runExtractionIfTemplate(
  jobId: string,
  pageId: string,
  pageUrl: string,
  item: FirecrawlPageResult,
  userId?: string,
): Promise<void> {
  const extractedData = await extractStructuredDataIfTemplate(pageUrl, item, userId);
  if (extractedData) {
    await getPageRepository().update(pageId, {
      extractedData,
    });
  }
}

