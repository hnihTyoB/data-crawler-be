import "dotenv/config";
import { Job } from "bullmq";
import { CrawlJobRepository } from "../modules/crawl-jobs/crawl-job.repository";
import { CrawlPageRepository } from "../modules/crawl-pages/crawl-page.repository";
import { CrawlAssetRepository } from "../modules/crawl-assets/crawl-asset.repository";
import { FirecrawlService } from "../modules/firecrawl/firecrawl.service";
import { CrawlPageProcessorService } from "../modules/crawl-pages/crawl-page-processor.service";
import { SensitiveScanService } from "../modules/crawl-pages/sensitive-scan.service";
import {
  mapCrawlError,
  getErrorMessage,
} from "../common/helpers/error-mapping.helper";
import { validateUrlAsync } from "../common/helpers/url.helper";
import { AppError } from "../common/errors/app-error";
import {
  FirecrawlPageResult,
  CrawlStatusResult,
} from "../modules/firecrawl/firecrawl.dto";
import {
  runExtractionIfTemplate,
  extractStructuredDataIfTemplate,
  clearTemplateCache,
} from "../modules/extraction-templates/extraction-runner";
import { JOB_STATUS } from "../common/constants/job-status.constant";
import { CRAWL_MODE } from "../common/constants/crawl-mode.constant";
import { ASSET_TYPE } from "../common/constants/asset-type.constant";
import { CRAWL_PAGE_STATUS } from "../common/constants/crawl-page-status.constant";
import { WEBHOOK_EVENT } from "../common/constants/webhook.constant";
import { systemConfigService } from "../modules/system-config/system-config.service";
// Lazy getters — instantiated on first use so Jest mocks replace constructors before creation
const getJobRepository = () => new CrawlJobRepository();
const getPageRepository = () => new CrawlPageRepository();
const getAssetRepository = () => new CrawlAssetRepository();
const getFirecrawlService = () => new FirecrawlService();
const getPageProcessor = () => new CrawlPageProcessorService();
const getSensitiveScanner = () => new SensitiveScanService();

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  jobId: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Job ${jobId} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

/** Saves IMAGE, LINK, and PDF assets for a single scraped page in one batch. */
export async function savePageAssets(
  jobId: string,
  pageId: string,
  item: FirecrawlPageResult,
): Promise<void> {
  const assetsBatch: Parameters<CrawlAssetRepository["createMany"]>[0] = [];

  if (item.images && item.images.length > 0) {
    item.images.forEach((img, index) => {
      const ext =
        img.url.split(".").pop()?.split("?")[0]?.toLowerCase() || "image";
      assetsBatch.push({
        jobId,
        pageId,
        assetType: ASSET_TYPE.IMAGE,
        url: img.url,
        sourceUrl: item.url,
        altText: img.alt || undefined,
        mimeType: ext,
        orderIndex: index + 1,
      });
    });
  }

  if (item.links && item.links.length > 0) {
    item.links.forEach((link, index) => {
      assetsBatch.push({
        jobId,
        pageId,
        assetType: ASSET_TYPE.LINK,
        url: link.url,
        sourceUrl: item.url,
        altText: link.text || undefined,
        orderIndex: index + 1,
      });
    });
  }

  if (item.pdfs && item.pdfs.length > 0) {
    item.pdfs.forEach((pdfUrl, index) => {
      assetsBatch.push({
        jobId,
        pageId,
        assetType: ASSET_TYPE.PDF,
        url: pdfUrl,
        sourceUrl: item.url,
        orderIndex: index + 1,
      });
    });
  }

  if (assetsBatch.length > 0) {
    await getAssetRepository().createMany(assetsBatch);
  }
}

/**
 * Scans all provided text fields for sensitive data and flags the page if found.
 */
export async function scanAndFlagPage(
  pageId: string,
  ...texts: (string | undefined)[]
): Promise<void> {
  const combined = texts.filter(Boolean).join(" ");
  if (!combined) return;
  if (getSensitiveScanner().hasSensitiveData(combined)) {
    await getPageRepository().update(pageId, { hasSensitiveData: true });
  }
}

/**
 * Persists all pages, failed URLs, and robots-blocked URLs from a batch result.
 *
 * Idempotency: uses upsert on the (jobId, url) unique constraint so that a
 * BullMQ retry of the same job does not produce duplicate CrawlPage rows.
 * On retry the existing row is overwritten with fresh data — this is safe
 * because the content comes from the same crawl and is deterministic.
 *
 * Updates crawl job progress counters every 10 pages saved.
 */
/**
 * Persists a single scraped page (upsert, assets, sensitive scan, extraction template).
 */
export async function persistSinglePage(
  jobId: string,
  item: FirecrawlPageResult,
  userId?: string,
): Promise<{ success: boolean; saved: boolean }> {
  try {
    const normalized = getPageProcessor().normalize(item, jobId);

    // Quét nhạy cảm in-memory trước khi ghi DB (loại bỏ 1 lệnh update riêng)
    const combinedTexts = [
      normalized.markdownContent,
      normalized.title,
      normalized.description,
    ]
      .filter(Boolean)
      .join(" ");
    const hasSensitiveData = combinedTexts
      ? getSensitiveScanner().hasSensitiveData(combinedTexts)
      : false;

    // Trích xuất cấu trúc in-memory theo template cache (loại bỏ 1 lệnh update và N+1 query)
    const extractedData = await extractStructuredDataIfTemplate(
      item.url,
      item,
      userId,
    );

    // Gom cụm 1 lần Upsert duy nhất cho mỗi trang cào
    const page = await getPageRepository().upsert({
      ...normalized,
      hasSensitiveData,
      extractedData: extractedData ?? undefined,
    });

    await savePageAssets(jobId, page.id, item);
    return { success: item.success, saved: true };
  } catch (err: unknown) {
    console.error(
      `[Worker] Failed to save page ${item.url}: ${getErrorMessage(err)}`,
    );
    return { success: false, saved: false };
  }
}

/**
 * Persists incremental scraped pages, skipping already persisted URLs.
 */
export async function persistIncrementalPages(
  jobId: string,
  pages: FirecrawlPageResult[],
  persistedUrls: Set<string>,
  userId?: string,
): Promise<{ newSuccess: number; newFailed: number; newErrors: number }> {
  let newSuccess = 0;
  let newFailed = 0;
  let newErrors = 0;

  for (const item of pages) {
    if (persistedUrls.has(item.url)) continue;
    persistedUrls.add(item.url);

    const res = await persistSinglePage(jobId, item, userId);
    if (!res.saved) {
      newErrors++;
    } else if (res.success) {
      newSuccess++;
    } else {
      newFailed++;
    }
  }

  return { newSuccess, newFailed, newErrors };
}

export async function persistBatchResults(
  jobId: string,
  result: CrawlStatusResult,
  userId?: string,
  persistedUrls = new Set<string>(),
): Promise<{
  successCount: number;
  failedCount: number;
  saveErrors: number;
  totalPages: number;
}> {
  let successCount = 0;
  let failedCount = 0;
  let saveErrors = 0;

  for (const item of result.pages) {
    if (persistedUrls.has(item.url)) {
      if (item.success) successCount++;
      else failedCount++;
      continue;
    }
    persistedUrls.add(item.url);
    const res = await persistSinglePage(jobId, item, userId);
    if (!res.saved) {
      saveErrors++;
    } else if (res.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Update DB progress counters every 10 pages — avoids N DB writes for large batches
    const saved = successCount + failedCount + saveErrors;
    if (saved % 10 === 0) {
      void getJobRepository().updateProgress(jobId, {
        successPages: successCount,
        failedPages: failedCount + saveErrors,
        totalPages: persistedUrls.size,
      });
    }
  }

  for (const failed of result.failedUrls ?? []) {
    if (persistedUrls.has(failed.url)) continue;
    persistedUrls.add(failed.url);
    try {
      const normalized = getPageProcessor().normalizeFailedPage(failed, jobId);
      await getPageRepository().upsert(normalized);
      failedCount++;
    } catch (err: unknown) {
      console.error(
        `[Worker] Failed to save error page ${failed.url}: ${getErrorMessage(err)}`,
      );
      saveErrors++;
    }
  }

  for (const blockedUrl of result.robotsBlockedUrls ?? []) {
    if (persistedUrls.has(blockedUrl)) continue;
    persistedUrls.add(blockedUrl);
    try {
      const normalized = getPageProcessor().normalizeFailedPage(
        { url: blockedUrl, error: "Blocked by robots.txt" },
        jobId,
        CRAWL_PAGE_STATUS.BLOCKED,
      );
      await getPageRepository().upsert(normalized);
      failedCount++;
    } catch (err: unknown) {
      console.error(
        `[Worker] Failed to save robots-blocked page ${blockedUrl}: ${getErrorMessage(err)}`,
      );
      saveErrors++;
    }
  }

  return { successCount, failedCount, saveErrors, totalPages: persistedUrls.size };
}

async function logStep(
  jobId: string,
  level: "INFO" | "WARNING" | "ERROR",
  step: string,
  message: string,
): Promise<void> {
  try {
    await getJobRepository().createJobLog({ jobId, level, step, message });
  } catch {
    // Non-fatal if database logging fails
  }
}

export async function processCrawlJob(job: Job): Promise<void> {
  const { jobId } = job.data;
  const crawlJob = await getJobRepository().findById(jobId);

  if (!crawlJob) {
    throw new Error(`CrawlJob ${jobId} not found`);
  }

  if (crawlJob.status === JOB_STATUS.CANCELED) {
    return;
  }

  await getJobRepository().updateStatus(jobId, JOB_STATUS.RUNNING, {
    startedAt: new Date(),
  });
  void logStep(
    jobId,
    "INFO",
    "INITIALIZE",
    `Job started, mode=${crawlJob.mode}`,
  );

  try {
    if (crawlJob.mode !== CRAWL_MODE.URL_LIST) {
      try {
        await validateUrlAsync(crawlJob.startUrl);
      } catch (err) {
        const message =
          err instanceof AppError
            ? err.message
            : "URL validation failed before crawl";
        await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
          finishedAt: new Date(),
          errorMessage: message,
          totalPages: 0,
          successPages: 0,
          failedPages: 0,
        });
        console.error(
          `[Worker] Job ${jobId} blocked by pre-crawl URL validation: ${message}`,
        );
        return;
      }
    }

    try {
      if (crawlJob.mode === CRAWL_MODE.SCRAPE) {
        console.log(
          `[Worker] Job ${jobId} started, mode=SCRAPE, url=${crawlJob.startUrl}`,
        );

        const result = await getFirecrawlService().scrapePage(
          crawlJob.startUrl,
        );

        if (!result.success) {
          const normalized = getPageProcessor().normalize(result, jobId);
          await getPageRepository().upsert(normalized);
          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error),
            totalPages: 1,
            successPages: 0,
            failedPages: 1,
          });
          console.log(
            `[Worker] Job ${jobId} completed: 0 success, 1 failed, 1 total`,
          );
          return;
        }

        const normalized = getPageProcessor().normalize(result, jobId);
        const page = await getPageRepository().upsert(normalized);
        await savePageAssets(jobId, page.id, result);
        await scanAndFlagPage(
          page.id,
          normalized.markdownContent,
          normalized.title,
          normalized.description,
        );
        await runExtractionIfTemplate(
          jobId,
          page.id,
          crawlJob.startUrl,
          result,
          crawlJob.userId,
        );
        await getJobRepository().updateStatus(jobId, JOB_STATUS.COMPLETED, {
          finishedAt: new Date(),
          totalPages: 1,
          successPages: 1,
          failedPages: 0,
        });
        console.log(
          `[Worker] Job ${jobId} completed: 1 success, 0 failed, 1 total`,
        );
      } else if (crawlJob.mode === CRAWL_MODE.SITEMAP) {
        console.log(
          `[Worker] Job ${jobId} started, mode=SITEMAP, url=${crawlJob.startUrl}`,
        );

        let sitemapUrls: string[];
        try {
          sitemapUrls = await getFirecrawlService().parseSitemapUrls(
            crawlJob.startUrl,
            crawlJob.maxPages,
          );
        } catch (err: unknown) {
          const errorMessage = getErrorMessage(err);
          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(
              errorMessage || "Failed to parse sitemap",
            ),
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          console.error(
            `[Worker] Job ${jobId} sitemap parse failed: ${errorMessage}`,
          );
          return;
        }

        if (sitemapUrls.length === 0) {
          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: "Sitemap contains no valid URLs to crawl.",
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          console.log(
            `[Worker] Job ${jobId} sitemap empty — no URLs to scrape`,
          );
          return;
        }

        console.log(
          `[Worker] Job ${jobId} sitemap parsed: ${sitemapUrls.length} URLs`,
        );

        const persistedUrls = new Set<string>();
        let currentSuccessCount = 0;
        let currentFailedCount = 0;
        let pollCount = 0;

        const result = await getFirecrawlService().batchScrapePages(
          sitemapUrls,
          crawlJob.maxPages,
          async (completed, total, currentPages) => {
            if (currentPages && currentPages.length > 0) {
              const { newSuccess, newFailed } = await persistIncrementalPages(
                jobId,
                currentPages,
                persistedUrls,
                crawlJob.userId,
              );
              currentSuccessCount += newSuccess;
              currentFailedCount += newFailed;
            }

            const effectiveSuccess = Math.max(completed, currentSuccessCount);
            const progressData: {
              successPages: number;
              totalPages: number;
              failedPages?: number;
            } = {
              successPages: effectiveSuccess,
              totalPages: total,
            };
            if (currentFailedCount > 0) {
              progressData.failedPages = currentFailedCount;
            }
            await Promise.all([
              job.updateProgress({ completed: effectiveSuccess, total }),
              getJobRepository().updateProgress(jobId, progressData),
            ]);
          },
          async () => {
            pollCount++;
            if (pollCount % 5 !== 0) return false;
            const current = await getJobRepository().findById(jobId);
            return current?.status === JOB_STATUS.CANCELED;
          },
        );

        if (!result.success) {
          if (result.status === "cancelled") {
            console.log(
              `[Worker] Job ${jobId} sitemap scrape was cancelled. Preserved ${persistedUrls.size} crawled pages.`,
            );
            await getJobRepository().updateStatus(jobId, JOB_STATUS.CANCELED, {
              finishedAt: new Date(),
              successPages: currentSuccessCount,
              totalPages: Math.max(result.total, persistedUrls.size),
            });
            return;
          }

          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? "Batch scrape failed"),
            totalPages: Math.max(result.total, persistedUrls.size),
            successPages: currentSuccessCount,
            failedPages: Math.max(1, result.total - currentSuccessCount),
          });
          console.log(
            `[Worker] Job ${jobId} batch scrape failed: ${result.error ?? "Batch scrape failed"}`,
          );
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } =
          await persistBatchResults(jobId, result, crawlJob.userId, persistedUrls);
        console.log(
          `[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`,
        );
        await getJobRepository().updateStatus(jobId, JOB_STATUS.COMPLETED, {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });
      } else if (crawlJob.mode === CRAWL_MODE.URL_LIST) {
        console.log(
          `[Worker] Job ${jobId} started, mode=URL_LIST, ${crawlJob.urls.length} URLs`,
        );

        if (!crawlJob.urls || crawlJob.urls.length === 0) {
          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: "URL_LIST mode requires at least one URL",
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          return;
        }

        const persistedUrls = new Set<string>();
        let currentSuccessCount = 0;
        let currentFailedCount = 0;
        let pollCount = 0;

        const result = await getFirecrawlService().batchScrapePages(
          crawlJob.urls,
          crawlJob.maxPages,
          async (completed, total, currentPages) => {
            if (currentPages && currentPages.length > 0) {
              const { newSuccess, newFailed } = await persistIncrementalPages(
                jobId,
                currentPages,
                persistedUrls,
                crawlJob.userId,
              );
              currentSuccessCount += newSuccess;
              currentFailedCount += newFailed;
            }

            const effectiveSuccess = Math.max(completed, currentSuccessCount);
            const progressData: {
              successPages: number;
              totalPages: number;
              failedPages?: number;
            } = {
              successPages: effectiveSuccess,
              totalPages: total,
            };
            if (currentFailedCount > 0) {
              progressData.failedPages = currentFailedCount;
            }
            await Promise.all([
              job.updateProgress({ completed: effectiveSuccess, total }),
              getJobRepository().updateProgress(jobId, progressData),
            ]);
          },
          async () => {
            pollCount++;
            if (pollCount % 5 !== 0) return false;
            const current = await getJobRepository().findById(jobId);
            return current?.status === JOB_STATUS.CANCELED;
          },
        );

        if (!result.success) {
          if (result.status === "cancelled") {
            console.log(
              `[Worker] Job ${jobId} URL_LIST scrape was cancelled. Preserved ${persistedUrls.size} crawled pages.`,
            );
            await getJobRepository().updateStatus(jobId, JOB_STATUS.CANCELED, {
              finishedAt: new Date(),
              successPages: currentSuccessCount,
              totalPages: Math.max(result.total, persistedUrls.size),
            });
            return;
          }

          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? "Batch scrape failed"),
            totalPages: Math.max(result.total, persistedUrls.size),
            successPages: currentSuccessCount,
            failedPages: Math.max(1, result.total - currentSuccessCount),
          });
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } =
          await persistBatchResults(jobId, result, crawlJob.userId, persistedUrls);
        console.log(
          `[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`,
        );
        await getJobRepository().updateStatus(jobId, JOB_STATUS.COMPLETED, {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });
      } else {
        // CRAWL mode
        console.log(
          `[Worker] Job ${jobId} started, mode=${crawlJob.mode}, url=${crawlJob.startUrl}`,
        );

        const persistedUrls = new Set<string>();
        let currentSuccessCount = 0;
        let currentFailedCount = 0;
        let pollCount = 0;
        let firecrawlJobIdSaved = false;

        const result = await getFirecrawlService().crawlSite(
          crawlJob.startUrl,
          crawlJob.maxPages,
          crawlJob.maxDepth,
          async (completed, total, currentPages) => {
            if (currentPages && currentPages.length > 0) {
              const { newSuccess, newFailed } = await persistIncrementalPages(
                jobId,
                currentPages,
                persistedUrls,
                crawlJob.userId,
              );
              currentSuccessCount += newSuccess;
              currentFailedCount += newFailed;
            }

            const effectiveSuccess = Math.max(completed, currentSuccessCount);
            const progressData: {
              successPages: number;
              totalPages: number;
              failedPages?: number;
            } = {
              successPages: effectiveSuccess,
              totalPages: total,
            };
            if (currentFailedCount > 0) {
              progressData.failedPages = currentFailedCount;
            }
            await Promise.all([
              job.updateProgress({ completed: effectiveSuccess, total }),
              getJobRepository().updateProgress(jobId, progressData),
            ]);
          },
          async () => {
            pollCount++;

            // On the very first poll, crawlSite has already started and we have
            // the Firecrawl job ID available via the result — but we can't access
            // it here yet. Instead we save it after crawlSite() returns below.
            // The shouldCancel hook only needs the DB status.

            if (pollCount % 5 !== 0) return false;
            const current = await getJobRepository().findById(jobId);
            return current?.status === JOB_STATUS.CANCELED;
          },
        );

        // Persist the Firecrawl job ID as soon as we have it, so a subsequent
        // cancel request can call cancelCrawl() even if the job is still running.
        if (result.firecrawlJobId && !firecrawlJobIdSaved) {
          firecrawlJobIdSaved = true;
          void getJobRepository().saveFirecrawlJobId(
            jobId,
            result.firecrawlJobId,
          );
        }

        if (!result.success) {
          if (result.status === "cancelled") {
            console.log(
              `[Worker] Job ${jobId} crawl was cancelled. Preserved ${persistedUrls.size} crawled pages.`,
            );
            await getJobRepository().updateStatus(jobId, JOB_STATUS.CANCELED, {
              finishedAt: new Date(),
              successPages: currentSuccessCount,
              totalPages: Math.max(result.total, persistedUrls.size),
            });
            return;
          }

          await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? "Crawl failed"),
            totalPages: Math.max(result.total, persistedUrls.size),
            successPages: currentSuccessCount,
            failedPages: Math.max(1, result.total - currentSuccessCount),
          });
          console.log(
            `[Worker] Job ${jobId} crawl failed: ${result.error ?? "Crawl failed"}`,
          );
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } =
          await persistBatchResults(jobId, result, crawlJob.userId, persistedUrls);
        console.log(
          `[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`,
        );
        await getJobRepository().updateStatus(jobId, JOB_STATUS.COMPLETED, {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });
      }

      // Generate diff_report.json upon successful job completion (if feature flag is enabled)
      const isDiffEnabled = await systemConfigService.isFeatureEnabled(
        "feature.change_detection.enabled",
        true,
      );
      if (isDiffEnabled) {
        try {
          const { ChangeDetectionService } =
            await import("../modules/change-detection/change-detection.service");
          const changeDetectionService = new ChangeDetectionService();
          const diffReport =
            await changeDetectionService.generateAndSaveDiffReport(jobId);
          console.log(
            `[Worker] Diff report generated for job ${jobId}: ${diffReport.summary.newPagesCount} new, ${diffReport.summary.modifiedPagesCount} modified, ${diffReport.summary.deletedPagesCount} deleted, ${diffReport.summary.unchangedPagesCount} unchanged`,
          );
        } catch (diffErr: unknown) {
          console.error(
            `[Worker] Failed to generate diff report for job ${jobId}:`,
            getErrorMessage(diffErr),
          );
        }
      } else {
        console.log(
          `[Worker] Skipped diff report for job ${jobId}: feature.change_detection.enabled is false`,
        );
      }
    } catch (error: unknown) {
      await getJobRepository().updateStatus(jobId, JOB_STATUS.FAILED, {
        finishedAt: new Date(),
        errorMessage: mapCrawlError(getErrorMessage(error)),
      });
      throw error;
    }
  } finally {
    try {
      const updatedJob = await getJobRepository().findById(jobId);
      if (
        updatedJob &&
        (updatedJob.status === JOB_STATUS.COMPLETED ||
          updatedJob.status === JOB_STATUS.FAILED)
      ) {
        const isWebhookEnabled = await systemConfigService.isFeatureEnabled(
          "feature.webhook.deliveries.enabled",
          true,
        );
        if (isWebhookEnabled) {
          const { WebhookDeliveryService } =
            await import("../modules/webhooks/webhook-delivery.service");
          const webhookDeliveryService = new WebhookDeliveryService();

          const event =
            updatedJob.status === JOB_STATUS.COMPLETED
              ? WEBHOOK_EVENT.JOB_COMPLETED
              : WEBHOOK_EVENT.JOB_FAILED;
          void logStep(
            jobId,
            updatedJob.status === JOB_STATUS.COMPLETED ? "INFO" : "ERROR",
            updatedJob.status,
            `Job finished with status ${updatedJob.status}${updatedJob.errorMessage ? `: ${updatedJob.errorMessage}` : ""}`,
          );
          const diffSummary =
            updatedJob &&
            typeof updatedJob === "object" &&
            "diffSummary" in updatedJob
              ? ((updatedJob as { diffSummary: unknown }).diffSummary ?? null)
              : null;
          const payload = {
            jobId: updatedJob.id,
            status: updatedJob.status,
            startUrl: updatedJob.startUrl,
            mode: updatedJob.mode,
            totalPages: updatedJob.totalPages,
            successPages: updatedJob.successPages,
            failedPages: updatedJob.failedPages,
            errorMessage: updatedJob.errorMessage,
            diffSummary,
            startedAt: updatedJob.startedAt,
            finishedAt: updatedJob.finishedAt,
          };

          void webhookDeliveryService.dispatch(
            updatedJob.id,
            updatedJob.userId,
            event,
            payload,
          );
        }
      }
    } catch (webhookErr) {
      console.error(
        `[Worker] Failed to dispatch webhook for job ${jobId}:`,
        webhookErr,
      );
    } finally {
      clearTemplateCache();
    }
  }
}
