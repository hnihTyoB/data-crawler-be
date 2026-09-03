import "dotenv/config";
import { getSecureAxios } from "../../common/helpers/url.helper";
import * as cheerio from "cheerio";
import { getFirecrawlClient } from "./firecrawl.client";
import { firecrawlConfig } from "../../config/firecrawl.config";
import {
  FirecrawlPageResult,
  FirecrawlImageResult,
  CrawlStatusResult,
  FirecrawlLinkResult,
  CrawlErrorItem,
} from "./firecrawl.dto";
import type { FirecrawlDocument } from "@mendable/firecrawl-js";
import { getErrorMessage } from "../../common/helpers/error-mapping.helper";

const POLL_INTERVAL_MS = 3000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

export function extractImages(html?: string): FirecrawlImageResult[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const images: FirecrawlImageResult[] = [];
  $("img").each((_, el) => {
    const url = $(el).attr("src");
    if (!url) return;
    const alt = $(el).attr("alt");
    images.push(alt !== undefined ? { url, alt } : { url });
  });
  return images;
}

export function extractLinks(html?: string): FirecrawlLinkResult[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const links: FirecrawlLinkResult[] = [];
  $("a").each((_, el) => {
    const url = $(el).attr("href");
    if (!url || !url.startsWith("http")) return;
    if (url.toLowerCase().endsWith(".pdf")) return;
    const text = $(el).text().trim() || undefined;
    links.push(text ? { url, text } : { url });
  });
  return links;
}

export function extractPdfs(html?: string): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const pdfs: string[] = [];
  $("a").each((_, el) => {
    const url = $(el).attr("href");
    if (!url || !url.startsWith("http")) return;
    if (url.toLowerCase().endsWith(".pdf")) pdfs.push(url);
  });
  return pdfs;
}

function normalizePage(
  doc: FirecrawlDocument,
  fallbackUrl: string,
): FirecrawlPageResult {
  return {
    url: doc.url ?? doc.metadata?.sourceURL ?? fallbackUrl,
    title: doc.title ?? doc.metadata?.title,
    description: doc.description ?? doc.metadata?.description,
    markdown: doc.markdown,
    statusCode: doc.metadata?.statusCode,
    images: extractImages(doc.html),
    links: extractLinks(doc.html),
    pdfs: extractPdfs(doc.html),
    success: true,
  };
}

export class FirecrawlService {
  async scrapePage(url: string): Promise<FirecrawlPageResult> {
    const client = getFirecrawlClient();
    const result = await withTimeout(
      client.scrapeUrl(url, {
        formats: ["markdown", "html"],
        timeout: firecrawlConfig.requestTimeoutMs,
      }),
      firecrawlConfig.requestTimeoutMs,
      `scrapeUrl(${url})`,
    );
    if (!result.success) {
      return {
        url,
        success: false,
        error: result.error ?? "Unknown Firecrawl error",
      };
    }
    return normalizePage(result, url);
  }

  async crawlSite(
    url: string,
    maxPages: number,
    maxDepth: number,
    onProgress?: (completed: number, total: number) => void | Promise<void>,
    shouldCancel?: () => Promise<boolean>,
  ): Promise<CrawlStatusResult> {
    const client = getFirecrawlClient();

    const start = await withTimeout(
      client.asyncCrawlUrl(url, {
        limit: maxPages,
        maxDepth,
        scrapeOptions: { formats: ["markdown", "html"] },
      }),
      firecrawlConfig.requestTimeoutMs,
      `asyncCrawlUrl(${url})`,
    );

    if (!start.success || !start.id) {
      return {
        status: "failed",
        completed: 0,
        total: 0,
        pages: [],
        success: false,
        error: start.error ?? "Failed to start crawl",
      };
    }

    // Surface the Firecrawl job ID so the worker can persist it for cancel support
    const firecrawlJobId = start.id;

    while (true) {
      if (shouldCancel && (await shouldCancel())) {
        return {
          status: "cancelled",
          completed: 0,
          total: 0,
          pages: [],
          success: false,
          firecrawlJobId,
          error: "Cancelled locally before Firecrawl crawl finished",
        };
      }

      const status = await withTimeout(
        client.checkCrawlStatus(firecrawlJobId),
        firecrawlConfig.requestTimeoutMs,
        `checkCrawlStatus(${firecrawlJobId})`,
      );

      if (!status.success) {
        return {
          status: "failed",
          completed: 0,
          total: 0,
          pages: [],
          success: false,
          firecrawlJobId,
          error: status.error ?? "Failed to check crawl status",
        };
      }

      await onProgress?.(status.completed, status.total);

      if (
        status.status === "completed" ||
        status.status === "failed" ||
        status.status === "cancelled"
      ) {
        let failedUrls: CrawlErrorItem[] | undefined;
        let robotsBlockedUrls: string[] | undefined;

        if (status.status !== "cancelled") {
          try {
            const errorsResult = await withTimeout(
              client.checkCrawlErrors(firecrawlJobId),
              firecrawlConfig.requestTimeoutMs,
              `checkCrawlErrors(${firecrawlJobId})`,
            );
            if ("errors" in errorsResult) {
              failedUrls = errorsResult.errors.map((e) => ({
                url: e.url,
                error: e.error,
              }));
              robotsBlockedUrls = errorsResult.robotsBlocked;
            }
          } catch {
            // Don't fail the whole crawl result over a diagnostics call
          }
        }

        const hasPages = status.data.length > 0;
        return {
          status: status.status,
          completed: status.completed,
          total: status.total,
          pages: status.data.map((doc) => normalizePage(doc, url)),
          failedUrls,
          robotsBlockedUrls,
          firecrawlJobId,
          success: hasPages || status.status === "completed",
          error:
            status.status === "failed" && !hasPages
              ? "Crawl failed with no pages returned"
              : undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /**
   * Calls Firecrawl's cancel endpoint for a CRAWL-mode job.
   * Safe to call even if the job has already completed — Firecrawl returns
   * a non-error response in that case.
   * Only CRAWL mode has a Firecrawl-side cancel API; SITEMAP/URL_LIST use
   * batchScrapePages which has no cancelBatch equivalent in the SDK.
   * If Firecrawl ever adds cancelBatch, extend this method and call it from
   * the cancel flow in crawl-job.service.ts.
   */
  async cancelCrawl(firecrawlJobId: string): Promise<void> {
    const client = getFirecrawlClient();
    try {
      await withTimeout(
        client.cancelCrawl(firecrawlJobId),
        firecrawlConfig.requestTimeoutMs,
        `cancelCrawl(${firecrawlJobId})`,
      );
    } catch (err: unknown) {
      // Log but don't throw — DB status is already CANCELED, provider cancel
      // is best-effort. A failed cancel doesn't break the user-facing operation.
      console.warn(
        `[FirecrawlService] cancelCrawl(${firecrawlJobId}) failed (best-effort): ${getErrorMessage(err)}`,
      );
    }
  }

  /**
   * Fetches a sitemap.xml URL and extracts all <loc> entries.
   * Respects maxPages limit if provided — trims the list before returning.
   * Throws a descriptive error if the fetch fails so the worker can mark
   * the job FAILED with a meaningful message.
   */
  async parseSitemapUrls(
    sitemapUrl: string,
    maxPages?: number,
  ): Promise<string[]> {
    let xml: string;
    try {
      const response = await withTimeout(
        getSecureAxios().get<string>(sitemapUrl, { responseType: "text" }),
        firecrawlConfig.requestTimeoutMs,
        `fetchSitemap(${sitemapUrl})`,
      );
      xml = response.data;
    } catch (err: unknown) {
      throw new Error(
        `Failed to fetch sitemap at ${sitemapUrl}: ${getErrorMessage(err)}`,
      );
    }

    // cheerio works on HTML by default; force xml mode so <loc> tags parse correctly
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $("loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });

    return maxPages !== undefined ? urls.slice(0, maxPages) : urls;
  }

  /**
   * Batch-scrapes a list of URLs via Firecrawl's async batch endpoint.
   * Mirrors crawlSite() in structure: async start → poll → collect results.
   * onProgress and shouldCancel hooks work identically to crawlSite().
   * NOTE: No Firecrawl-side cancel for batch — shouldCancel stops local
   * consumption only. If Firecrawl adds cancelBatch, wire it here.
   */
  async batchScrapePages(
    urls: string[],
    maxPages: number,
    onProgress?: (completed: number, total: number) => void | Promise<void>,
    shouldCancel?: () => Promise<boolean>,
  ): Promise<CrawlStatusResult> {
    const client = getFirecrawlClient();

    const start = await withTimeout(
      client.asyncBatchScrapeUrls(urls, {
        formats: ["markdown", "html"],
      } as unknown as { formats: ("markdown" | "html")[] }),
      firecrawlConfig.requestTimeoutMs,
      `asyncBatchScrapeUrls(${urls.length} URLs)`,
    );

    if (!start.success || !start.id) {
      const startError =
        start &&
        typeof start === "object" &&
        "error" in start &&
        typeof (start as { error: unknown }).error === "string"
          ? (start as { error: string }).error
          : "Failed to start batch scrape";
      return {
        status: "failed",
        completed: 0,
        total: 0,
        pages: [],
        success: false,
        error: startError,
      };
    }

    const batchId = start.id;

    while (true) {
      if (shouldCancel && (await shouldCancel())) {
        return {
          status: "cancelled",
          completed: 0,
          total: 0,
          pages: [],
          success: false,
          error: "Cancelled locally before batch scrape finished",
        };
      }

      const status = await withTimeout(
        client.checkBatchScrapeStatus(batchId),
        firecrawlConfig.requestTimeoutMs,
        `checkBatchScrapeStatus(${batchId})`,
      );

      if (!status.success) {
        const statusError =
          status &&
          typeof status === "object" &&
          "error" in status &&
          typeof (status as { error: unknown }).error === "string"
            ? (status as { error: string }).error
            : "Failed to check batch scrape status";
        return {
          status: "failed",
          completed: 0,
          total: 0,
          pages: [],
          success: false,
          error: statusError,
        };
      }

      await onProgress?.(status.completed, status.total);

      if (
        status.status === "completed" ||
        status.status === "failed" ||
        status.status === "cancelled"
      ) {
        let failedUrls: CrawlErrorItem[] | undefined;
        let robotsBlockedUrls: string[] | undefined;

        if (status.status !== "cancelled") {
          try {
            const errorsResult = await withTimeout(
              client.checkBatchScrapeErrors(batchId),
              firecrawlConfig.requestTimeoutMs,
              `checkBatchScrapeErrors(${batchId})`,
            );
            if (
              "errors" in errorsResult &&
              Array.isArray(errorsResult.errors)
            ) {
              failedUrls = errorsResult.errors.map(
                (e: { url: string; error?: string }) => ({
                  url: e.url,
                  error: e.error || "Unknown error",
                }),
              );
              robotsBlockedUrls = errorsResult.robotsBlocked;
            }
          } catch {
            // Don't fail over diagnostics
          }
        }

        const hasPages = status.data.length > 0;
        return {
          status: status.status,
          completed: status.completed,
          total: status.total,
          pages: status.data.map((doc) =>
            normalizePage(doc as FirecrawlDocument, urls[0]),
          ),
          failedUrls,
          robotsBlockedUrls,
          success: hasPages || status.status === "completed",
          error:
            status.status === "failed" && !hasPages
              ? "Batch scrape failed with no pages returned"
              : undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}
