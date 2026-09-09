import fs from "fs";
import { CrawlJob, Prisma } from "../../common/types/database.types";
import { CrawlJobRepository } from "../crawl-jobs/crawl-job.repository";
import {
  DiffReportEnvelope,
  DiffSummary,
  NewPageItem,
  ModifiedPageItem,
  DeletedPageItem,
  UnchangedPageItem,
} from "./change-detection.types";
import { JOB_EXPORT_FILES } from "../../common/constants/storage-path.constant";
import { buildJobRootFilePath } from "../../common/helpers/file.helper";
import { normalizeUrl } from "../../common/helpers/data-contract.helper";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { CrawlPageStatus } from "../../common/constants/crawl-page-status.constant";

/**
 * Minimal page shape required for diff comparison.
 * Matches the `select` fields used by findByIdWithPages / findPreviousCompleted*
 * to avoid loading full page content into worker memory.
 */
type DiffPage = {
  id: string;
  url: string;
  normalizedUrl: string | null;
  contentHash: string | null;
  wordCount: number;
  status: CrawlPageStatus;
  statusCode: number | null;
  title: string | null;
  crawledAt: Date | null;
};

export class ChangeDetectionService {
  private readonly jobRepository = new CrawlJobRepository();

  /**
   * Pure comparison algorithm between two jobs and their pages.
   */
  public comparePageSets(
    currentJob: CrawlJob & { pages: DiffPage[] },
    previousJob?: (CrawlJob & { pages: DiffPage[] }) | null,
  ): DiffReportEnvelope {
    const currentPagesMap = new Map<string, DiffPage>();
    for (const page of currentJob.pages) {
      const key = normalizeUrl(page.url || page.normalizedUrl || "").toLowerCase();
      currentPagesMap.set(key, page);
    }

    const previousPagesMap = new Map<string, DiffPage>();
    if (previousJob) {
      for (const page of previousJob.pages) {
        const key = normalizeUrl(page.url || page.normalizedUrl || "").toLowerCase();
        previousPagesMap.set(key, page);
      }
    }

    const newPages: NewPageItem[] = [];
    const modifiedPages: ModifiedPageItem[] = [];
    const unchangedPages: UnchangedPageItem[] = [];
    const deletedPages: DeletedPageItem[] = [];

    // Check current pages against previous pages
    for (const [key, curr] of currentPagesMap.entries()) {
      const prev = previousPagesMap.get(key);

      if (!prev) {
        // Page was not in previous crawl -> NEW
        newPages.push({
          url: curr.url,
          normalizedUrl: curr.normalizedUrl || normalizeUrl(curr.url),
          title: curr.title ?? null,
          contentHash: curr.contentHash ?? null,
          wordCount: curr.wordCount,
          statusCode: curr.statusCode ?? null,
          crawledAt: curr.crawledAt?.toISOString() ?? null,
        });
      } else {
        // Page exists in both crawls -> compare contentHash
        const currHash = curr.contentHash;
        const prevHash = prev.contentHash;

        const isHashModified = currHash && prevHash && currHash !== prevHash;
        const isStatusModified = curr.status !== prev.status;
        const isWordCountSignificantlyModified =
          !currHash && !prevHash && curr.wordCount !== prev.wordCount;

        if (
          isHashModified ||
          isStatusModified ||
          isWordCountSignificantlyModified
        ) {
          modifiedPages.push({
            url: curr.url,
            normalizedUrl: curr.normalizedUrl || normalizeUrl(curr.url),
            title: curr.title ?? null,
            oldTitle: prev.title ?? null,
            oldContentHash: prevHash ?? null,
            newContentHash: currHash ?? null,
            oldWordCount: prev.wordCount,
            newWordCount: curr.wordCount,
            wordCountDiff: curr.wordCount - prev.wordCount,
            statusCode: curr.statusCode ?? null,
            crawledAt: curr.crawledAt?.toISOString() ?? null,
          });
        } else {
          unchangedPages.push({
            url: curr.url,
            normalizedUrl: curr.normalizedUrl || normalizeUrl(curr.url),
            title: curr.title ?? null,
            contentHash: currHash ?? null,
            wordCount: curr.wordCount,
          });
        }
      }
    }

    // Check for deleted pages (present in previous crawl but missing in current crawl)
    if (previousJob) {
      for (const [key, prev] of previousPagesMap.entries()) {
        if (!currentPagesMap.has(key)) {
          deletedPages.push({
            url: prev.url,
            normalizedUrl: prev.normalizedUrl || normalizeUrl(prev.url),
            title: prev.title ?? null,
            previousContentHash: prev.contentHash ?? null,
            previousWordCount: prev.wordCount,
            lastCrawledAt: prev.crawledAt?.toISOString() ?? null,
          });
        }
      }
    }

    const totalCurrentPages = currentJob.pages.length;
    const totalPreviousPages = previousJob?.pages.length ?? 0;
    const denominator = Math.max(totalCurrentPages, totalPreviousPages, 1);
    const changedCount =
      newPages.length + modifiedPages.length + deletedPages.length;
    const changeRate = parseFloat((changedCount / denominator).toFixed(4));

    const summary: DiffSummary = {
      totalCurrentPages,
      totalPreviousPages,
      newPagesCount: newPages.length,
      modifiedPagesCount: modifiedPages.length,
      deletedPagesCount: deletedPages.length,
      unchangedPagesCount: unchangedPages.length,
      changeRate,
    };

    return {
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      jobId: currentJob.id,
      previousJobId: previousJob?.id ?? null,
      scheduleId: currentJob.scheduleId ?? null,
      startUrl: currentJob.startUrl,
      domain: currentJob.domain ?? null,
      summary,
      changes: {
        new: newPages,
        modified: modifiedPages,
        deleted: deletedPages,
        unchanged: unchangedPages,
      },
    };
  }

  /**
   * Finds the best previous baseline job for a given job.
   */
  public async findBaselineJob(
    currentJob: CrawlJob,
  ): Promise<(CrawlJob & { pages: DiffPage[] }) | null> {
    if (currentJob.scheduleId) {
      const prevScheduleJob =
        await this.jobRepository.findPreviousCompletedJobForSchedule(
          currentJob.scheduleId,
          currentJob.id,
        );
      if (prevScheduleJob) return prevScheduleJob;
    }

    return this.jobRepository.findPreviousCompletedJobForDomain(
      currentJob.userId,
      currentJob.domain,
      currentJob.startUrl,
      currentJob.id,
    );
  }

  /**
   * Generates, saves to disk, and records the diff_report.json for a completed job.
   */
  public async generateAndSaveDiffReport(
    currentJobId: string,
    explicitCompareJobId?: string,
  ): Promise<DiffReportEnvelope> {
    const currentJob = await this.jobRepository.findByIdWithPages(currentJobId);
    if (!currentJob) {
      throw new AppError(
        "Crawl job not found",
        404,
        ERROR_CODE.CRAWL_JOB_NOT_FOUND,
      );
    }

    let previousJob: (CrawlJob & { pages: DiffPage[] }) | null = null;
    if (explicitCompareJobId) {
      previousJob =
        await this.jobRepository.findByIdWithPages(explicitCompareJobId);
      if (!previousJob) {
        throw new AppError(
          "Comparison crawl job not found",
          404,
          ERROR_CODE.CRAWL_JOB_NOT_FOUND,
        );
      }
    } else {
      previousJob = await this.findBaselineJob(currentJob);
    }

    const diffReport = this.comparePageSets(currentJob, previousJob);

    // Write diff_report.json to export directory
    const { filePath } = buildJobRootFilePath(
      currentJobId,
      JOB_EXPORT_FILES.DIFF_REPORT_JSON,
    );
    fs.writeFileSync(filePath, JSON.stringify(diffReport, null, 2), "utf-8");

    // Persist diff summary & path on the crawl job
    await this.jobRepository.updateDiffReport(
      currentJobId,
      filePath,
      diffReport.summary as unknown as Prisma.InputJsonValue,
    );

    return diffReport;
  }

  /**
   * Retrieves the diff report for a job, generating it if not present.
   */
  public async getDiffReport(
    currentJobId: string,
    explicitCompareJobId?: string,
  ): Promise<DiffReportEnvelope> {
    if (explicitCompareJobId) {
      return this.generateAndSaveDiffReport(currentJobId, explicitCompareJobId);
    }

    const { filePath } = buildJobRootFilePath(
      currentJobId,
      JOB_EXPORT_FILES.DIFF_REPORT_JSON,
    );
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content) as DiffReportEnvelope;
      } catch {
        // If file is corrupt, regenerate
      }
    }

    return this.generateAndSaveDiffReport(currentJobId);
  }
}
