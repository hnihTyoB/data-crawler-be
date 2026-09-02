import { CrawlPageStatus } from '@prisma/client';
import { FirecrawlPageResult, CrawlErrorItem } from '../firecrawl/firecrawl.dto';
import { mapCrawlError } from '../../common/helpers/error-mapping.helper';
import {
  normalizeUrl,
  stripMarkdown,
  extractMainContent,
  countWords,
  hashContent,
  calcDataQualityScore,
  detectWarnings,
} from '../../common/helpers/data-contract.helper';

export interface CreateCrawlPageData {
  jobId: string;
  url: string;
  normalizedUrl: string;
  title?: string;
  description?: string;
  markdownContent?: string;
  content?: string;
  status: CrawlPageStatus;
  statusCode?: number;
  errorMessage?: string;
  crawledAt: Date;
  wordCount: number;
  contentHash?: string;
  dataQualityScore?: number;
  warnings: string[];
}

export class CrawlPageProcessorService {
  /**
   * Infers the CrawlPageStatus from a raw error string and/or HTTP status code.
   *
   * Rule: error string patterns take priority over status code.
   * Patterns mirror mapCrawlError() exactly so status and message are always consistent.
   *
   * Made public for unit testing.
   */
  public inferStatus(rawError: string | undefined, statusCode: number | undefined): CrawlPageStatus {
    if (rawError) {
      const err = rawError.toLowerCase();

      // BLOCKED — robots.txt
      if (
        err.includes('robots') ||
        err.includes('robots.txt') ||
        err.includes('blocked by robots')
      ) {
        return 'BLOCKED';
      }

      // CAPTCHA_DETECTED
      if (err.includes('captcha')) {
        return 'CAPTCHA_DETECTED';
      }

      // PAYWALL_DETECTED
      if (err.includes('paywall')) {
        return 'PAYWALL_DETECTED';
      }

      // REQUIRES_LOGIN
      if (err.includes('requires login') || err.includes('login required')) {
        return 'REQUIRES_LOGIN';
      }

      // TIMEOUT
      if (err.includes('timeout') || err.includes('timed out')) {
        return 'TIMEOUT';
      }

      // BLOCKED — Cloudflare / WAF / IP block / rate limit
      // Must check API key case FIRST to avoid misclassifying auth errors as BLOCKED
      const isApiKeyError =
        err.includes('api key') ||
        err.includes('apikey') ||
        (err.includes('forbidden') && err.includes('key'));

      if (!isApiKeyError) {
        if (
          err.includes('cloudflare') ||
          err.includes('access denied') ||
          err.includes('private ip') ||
          err.includes('private_ip_blocked') ||
          err.includes('rate limit') ||
          err.includes('429') ||
          err.includes('too many requests') ||
          err.includes('403') ||
          (err.includes('forbidden') && !err.includes('key')) ||
          (err.includes('block') && (err.includes('ip') || err.includes('bot')))
        ) {
          return 'BLOCKED';
        }
      }

      // FAILED — everything else (auth errors, DNS, unknown)
      return 'FAILED';
    }

    if (statusCode !== undefined && statusCode >= 400) {
      return 'FAILED';
    }

    return 'SUCCESS';
  }

  normalize(rawPage: FirecrawlPageResult, jobId: string): CreateCrawlPageData {
    const status = rawPage.success
      ? this.inferStatus(undefined, rawPage.statusCode)
      : this.inferStatus(rawPage.error, rawPage.statusCode);

    const rawMarkdown = rawPage.markdown ?? '';
    const mainContent = extractMainContent(rawMarkdown);
    const cleanText = stripMarkdown(mainContent);
    const wordCount = countWords(cleanText);
    const contentHash = hashContent(cleanText) || undefined;

    const dataQualityScore = calcDataQualityScore({
      isSuccess: status === 'SUCCESS',
      mainContent: mainContent || null,
      wordCount,
      title: rawPage.title ?? null,
      description: rawPage.description ?? null,
    }) ?? undefined;

    const warnings = detectWarnings({
      title: rawPage.title ?? null,
      description: rawPage.description ?? null,
      wordCount,
      dataQualityScore: dataQualityScore ?? null,
      isDuplicateContent: false,
      isNavNoise: false,
    });

    return {
      jobId,
      url: rawPage.url,
      normalizedUrl: normalizeUrl(rawPage.url),
      title: rawPage.title ?? undefined,
      description: rawPage.description ?? undefined,
      markdownContent: rawPage.markdown ?? undefined,
      content: rawPage.markdown ?? undefined,
      status,
      statusCode: rawPage.statusCode ?? undefined,
      errorMessage: rawPage.error ? mapCrawlError(rawPage.error) : undefined,
      crawledAt: new Date(),
      wordCount,
      contentHash,
      dataQualityScore,
      warnings,
    };
  }

  normalizeFailedPage(
    errorItem: CrawlErrorItem,
    jobId: string,
    status?: CrawlPageStatus,
  ): CreateCrawlPageData {
    const finalStatus = status ?? this.inferStatus(errorItem.error, undefined);

    return {
      jobId,
      url: errorItem.url,
      normalizedUrl: normalizeUrl(errorItem.url),
      status: finalStatus,
      errorMessage: mapCrawlError(errorItem.error),
      crawledAt: new Date(),
      wordCount: 0,
      warnings: [],
    };
  }
}