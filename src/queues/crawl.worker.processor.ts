import 'dotenv/config';
import { Job } from 'bullmq';
import { CrawlJobRepository } from '../modules/crawl-jobs/crawl-job.repository';
import { CrawlPageRepository } from '../modules/crawl-pages/crawl-page.repository';
import { CrawlAssetRepository } from '../modules/crawl-assets/crawl-asset.repository';
import { FirecrawlService } from '../modules/firecrawl/firecrawl.service';
import { CrawlPageProcessorService } from '../modules/crawl-pages/crawl-page-processor.service';
import { SensitiveScanService } from '../modules/crawl-pages/sensitive-scan.service';
import { mapCrawlError } from '../common/helpers/error-mapping.helper';
import { validateUrlAsync } from '../common/helpers/url.helper';
import { AppError } from '../common/errors/app-error';
import { FirecrawlPageResult, CrawlStatusResult } from '../modules/firecrawl/firecrawl.dto';
import { runExtractionIfTemplate } from '../modules/extraction-templates/extraction-runner';
// Lazy getters — instantiated on first use so Jest mocks replace constructors before creation
const getJobRepository = () => new CrawlJobRepository();
const getPageRepository = () => new CrawlPageRepository();
const getAssetRepository = () => new CrawlAssetRepository();
const getFirecrawlService = () => new FirecrawlService();
const getPageProcessor = () => new CrawlPageProcessorService();
const getSensitiveScanner = () => new SensitiveScanService();

export function withTimeout<T>(promise: Promise<T>, ms: number, jobId: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Job ${jobId} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Saves IMAGE, LINK, and PDF assets for a single scraped page in one batch. */
export async function savePageAssets(
  jobId: string,
  pageId: string,
  item: FirecrawlPageResult,
): Promise<void> {
  const assetsBatch: Parameters<CrawlAssetRepository['createMany']>[0] = [];

  if (item.images && item.images.length > 0) {
    item.images.forEach((img, index) => {
      const ext = img.url.split('.').pop()?.split('?')[0]?.toLowerCase() || 'image';
      assetsBatch.push({
        jobId,
        pageId,
        assetType: 'IMAGE' as const,
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
        assetType: 'LINK' as const,
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
        assetType: 'PDF' as const,
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
export async function scanAndFlagPage(pageId: string, ...texts: (string | undefined)[]): Promise<void> {
  const combined = texts.filter(Boolean).join(' ');
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
export async function persistBatchResults(
  jobId: string,
  result: CrawlStatusResult,
): Promise<{ successCount: number; failedCount: number; saveErrors: number; totalPages: number }> {
  let successCount = 0;
  let failedCount = 0;
  let saveErrors = 0;
  const seenUrls = new Set<string>();

  for (const item of result.pages) {
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    try {
      const normalized = getPageProcessor().normalize(item, jobId);
      // upsert on (jobId, url) — idempotent on BullMQ retries
      const page = await getPageRepository().upsert(normalized);
      await savePageAssets(jobId, page.id, item);
      await scanAndFlagPage(page.id, normalized.markdownContent, normalized.title, normalized.description);
      await runExtractionIfTemplate(jobId, page.id, item.url, item);
      if (item.success) successCount++;
      else failedCount++;
    } catch (err: any) {
      console.error(`[Worker] Failed to save page ${item.url}: ${err?.message}`);
      saveErrors++;
    }

    // Update DB progress counters every 10 pages — avoids N DB writes for large batches
    const saved = successCount + failedCount + saveErrors;
    if (saved % 10 === 0) {
      void getJobRepository().updateProgress(jobId, {
        successPages: successCount,
        failedPages: failedCount + saveErrors,
        totalPages: seenUrls.size,
      });
    }
  }

  for (const failed of result.failedUrls ?? []) {
    if (seenUrls.has(failed.url)) continue;
    seenUrls.add(failed.url);
    try {
      const normalized = getPageProcessor().normalizeFailedPage(failed, jobId);
      await getPageRepository().upsert(normalized);
      failedCount++;
    } catch (err: any) {
      console.error(`[Worker] Failed to save error page ${failed.url}: ${err?.message}`);
      saveErrors++;
    }
  }

  for (const blockedUrl of result.robotsBlockedUrls ?? []) {
    if (seenUrls.has(blockedUrl)) continue;
    seenUrls.add(blockedUrl);
    try {
      const normalized = getPageProcessor().normalizeFailedPage(
        { url: blockedUrl, error: 'Blocked by robots.txt' },
        jobId,
        'BLOCKED',
      );
      await getPageRepository().upsert(normalized);
      failedCount++;
    } catch (err: any) {
      console.error(`[Worker] Failed to save robots-blocked page ${blockedUrl}: ${err?.message}`);
      saveErrors++;
    }
  }

  return { successCount, failedCount, saveErrors, totalPages: seenUrls.size };
}

export async function processCrawlJob(job: Job<{ jobId: string }>) {
  const { jobId } = job.data;

  const crawlJob = await getJobRepository().findById(jobId);

  if (!crawlJob) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    if (crawlJob.status === 'CANCELED') {
      console.log(`[Worker] Job ${jobId} was canceled before processing, skipping`);
      return;
    }

    if (crawlJob.mode !== 'URL_LIST') {
      try {
        await validateUrlAsync(crawlJob.startUrl);
      } catch (err) {
        const message = err instanceof AppError ? err.message : 'URL validation failed before crawl';
        await getJobRepository().updateStatus(jobId, 'FAILED', {
          finishedAt: new Date(),
          errorMessage: message,
          totalPages: 0,
          successPages: 0,
          failedPages: 0,
        });
        console.error(`[Worker] Job ${jobId} blocked by pre-crawl URL validation: ${message}`);
        return;
      }
    }

    await getJobRepository().updateStatus(jobId, 'RUNNING', { startedAt: new Date() });

    try {
      if (crawlJob.mode === 'SCRAPE') {
        console.log(`[Worker] Job ${jobId} started, mode=SCRAPE, url=${crawlJob.startUrl}`);

        const result = await getFirecrawlService().scrapePage(crawlJob.startUrl);

        if (!result.success) {
          const normalized = getPageProcessor().normalize(result, jobId);
          await getPageRepository().upsert(normalized);
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error),
            totalPages: 1,
            successPages: 0,
            failedPages: 1,
          });
          console.log(`[Worker] Job ${jobId} completed: 0 success, 1 failed, 1 total`);
          return;
        }

        const normalized = getPageProcessor().normalize(result, jobId);
        const page = await getPageRepository().upsert(normalized);
        await savePageAssets(jobId, page.id, result);
        await scanAndFlagPage(page.id, normalized.markdownContent, normalized.title, normalized.description);
        await runExtractionIfTemplate(jobId, page.id, crawlJob.startUrl, result);
        await getJobRepository().updateStatus(jobId, 'COMPLETED', {
          finishedAt: new Date(),
          totalPages: 1,
          successPages: 1,
          failedPages: 0,
        });
        console.log(`[Worker] Job ${jobId} completed: 1 success, 0 failed, 1 total`);

      } else if (crawlJob.mode === 'SITEMAP') {
        console.log(`[Worker] Job ${jobId} started, mode=SITEMAP, url=${crawlJob.startUrl}`);

        let sitemapUrls: string[];
        try {
          sitemapUrls = await getFirecrawlService().parseSitemapUrls(crawlJob.startUrl, crawlJob.maxPages);
        } catch (err: any) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(err?.message ?? 'Failed to parse sitemap'),
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          console.error(`[Worker] Job ${jobId} sitemap parse failed: ${err?.message}`);
          return;
        }

        if (sitemapUrls.length === 0) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: 'Sitemap contains no valid URLs to crawl.',
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          console.log(`[Worker] Job ${jobId} sitemap empty — no URLs to scrape`);
          return;
        }

        console.log(`[Worker] Job ${jobId} sitemap parsed: ${sitemapUrls.length} URLs`);

        let pollCount = 0;
        const result = await getFirecrawlService().batchScrapePages(
          sitemapUrls,
          crawlJob.maxPages,
          async (completed, total) => {
            await Promise.all([
              job.updateProgress({ completed, total }),
              getJobRepository().updateProgress(jobId, {
                successPages: completed,
                totalPages: total,
              }),
            ]);
          },
          async () => {
            pollCount++;
            if (pollCount % 5 !== 0) return false;
            const current = await getJobRepository().findById(jobId);
            return current?.status === 'CANCELED';
          },
        );

        if (!result.success) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? 'Batch scrape failed'),
            totalPages: result.total,
            successPages: 0,
            failedPages: result.total || 1,
          });
          console.log(`[Worker] Job ${jobId} batch scrape failed: ${result.error ?? 'Batch scrape failed'}`);
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } = await persistBatchResults(jobId, result);
        console.log(`[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`);
        await getJobRepository().updateStatus(jobId, 'COMPLETED', {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });

      } else if (crawlJob.mode === 'URL_LIST') {
        console.log(`[Worker] Job ${jobId} started, mode=URL_LIST, ${crawlJob.urls.length} URLs`);

        if (!crawlJob.urls || crawlJob.urls.length === 0) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: 'URL_LIST mode requires at least one URL',
            totalPages: 0,
            successPages: 0,
            failedPages: 0,
          });
          return;
        }

        let pollCount = 0;
        const result = await getFirecrawlService().batchScrapePages(
          crawlJob.urls,
          crawlJob.maxPages,
          async (completed, total) => {
            await Promise.all([
              job.updateProgress({ completed, total }),
              getJobRepository().updateProgress(jobId, {
                successPages: completed,
                totalPages: total,
              }),
            ]);
          },
          async () => {
            pollCount++;
            if (pollCount % 5 !== 0) return false;
            const current = await getJobRepository().findById(jobId);
            return current?.status === 'CANCELED';
          },
        );

        if (!result.success) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? 'Batch scrape failed'),
            totalPages: result.total,
            successPages: 0,
            failedPages: result.total || 1,
          });
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } = await persistBatchResults(jobId, result);
        console.log(`[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`);
        await getJobRepository().updateStatus(jobId, 'COMPLETED', {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });

      } else {
        // CRAWL mode
        console.log(`[Worker] Job ${jobId} started, mode=${crawlJob.mode}, url=${crawlJob.startUrl}`);

        let pollCount = 0;
        let firecrawlJobIdSaved = false;

        const result = await getFirecrawlService().crawlSite(
          crawlJob.startUrl,
          crawlJob.maxPages,
          crawlJob.maxDepth,
          async (completed, total) => {
            await Promise.all([
              job.updateProgress({ completed, total }),
              getJobRepository().updateProgress(jobId, {
                successPages: completed,
                totalPages: total,
              }),
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
            return current?.status === 'CANCELED';
          },
        );

        // Persist the Firecrawl job ID as soon as we have it, so a subsequent
        // cancel request can call cancelCrawl() even if the job is still running.
        if (result.firecrawlJobId && !firecrawlJobIdSaved) {
          firecrawlJobIdSaved = true;
          void getJobRepository().saveFirecrawlJobId(jobId, result.firecrawlJobId);
        }

        if (!result.success) {
          await getJobRepository().updateStatus(jobId, 'FAILED', {
            finishedAt: new Date(),
            errorMessage: mapCrawlError(result.error ?? 'Crawl failed'),
            totalPages: result.total,
            successPages: 0,
            failedPages: result.total || 1,
          });
          console.log(`[Worker] Job ${jobId} crawl failed: ${result.error ?? 'Crawl failed'}`);
          return;
        }

        const { successCount, failedCount, saveErrors, totalPages } = await persistBatchResults(jobId, result);
        console.log(`[Worker] Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${saveErrors} save errors, ${totalPages} total`);
        await getJobRepository().updateStatus(jobId, 'COMPLETED', {
          finishedAt: new Date(),
          totalPages,
          successPages: successCount,
          failedPages: failedCount + saveErrors,
        });
      }

      // Generate diff_report.json upon successful job completion
      try {
        const { ChangeDetectionService } = await import('../modules/change-detection/change-detection.service');
        const changeDetectionService = new ChangeDetectionService();
        const diffReport = await changeDetectionService.generateAndSaveDiffReport(jobId);
        console.log(
          `[Worker] Diff report generated for job ${jobId}: ${diffReport.summary.newPagesCount} new, ${diffReport.summary.modifiedPagesCount} modified, ${diffReport.summary.deletedPagesCount} deleted, ${diffReport.summary.unchangedPagesCount} unchanged`,
        );
      } catch (diffErr: any) {
        console.error(`[Worker] Failed to generate diff report for job ${jobId}:`, diffErr?.message);
      }
    } catch (error: any) {
      await getJobRepository().updateStatus(jobId, 'FAILED', {
        finishedAt: new Date(),
        errorMessage: mapCrawlError(error?.message ?? 'Unknown error'),
      });
      throw error;
    }
  } finally {
    try {
      const updatedJob = await getJobRepository().findById(jobId);
      if (updatedJob && (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED')) {
        const { WebhookDeliveryService } = await import('../modules/webhooks/webhook-delivery.service');
        const webhookDeliveryService = new WebhookDeliveryService();

        const event = updatedJob.status === 'COMPLETED' ? 'job.completed' : 'job.failed';
        const payload = {
          jobId: updatedJob.id,
          status: updatedJob.status,
          startUrl: updatedJob.startUrl,
          mode: updatedJob.mode,
          totalPages: updatedJob.totalPages,
          successPages: updatedJob.successPages,
          failedPages: updatedJob.failedPages,
          errorMessage: updatedJob.errorMessage,
          diffSummary: (updatedJob as any).diffSummary ?? null,
          startedAt: updatedJob.startedAt,
          finishedAt: updatedJob.finishedAt,
        };

        void webhookDeliveryService.dispatch(updatedJob.id, updatedJob.userId, event, payload);
      }
    } catch (webhookErr) {
      console.error(`[Worker] Failed to dispatch webhook for job ${jobId}:`, webhookErr);
    }
  }
}
