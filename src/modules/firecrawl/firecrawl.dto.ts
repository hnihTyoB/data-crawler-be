export interface FirecrawlPageResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  statusCode?: number;
  links?: FirecrawlLinkResult[];
  pdfs?: string[];
  images?: FirecrawlImageResult[];
  success: boolean;
  error?: string;
}
export interface FirecrawlLinkResult {
  url: string;
  text?: string;
}
export interface FirecrawlImageResult {
  url: string;
  alt?: string;
}

/** Input for a multi-page crawl. */
export interface CrawlInput {
  url: string;
  maxPages: number;
  maxDepth: number;
  timeoutMs?: number;
}

/** Result of asyncCrawlUrl() — a job handle, not the crawl result itself. */
export interface CrawlJobHandle {
  firecrawlJobId: string;
  success: boolean;
  error?: string;
}

export interface CrawlErrorItem {
  url: string;
  error: string;
}

/** Result of polling checkCrawlStatus(). */
export interface CrawlStatusResult {
  status: 'scraping' | 'completed' | 'failed' | 'cancelled';
  completed: number;
  total: number;
  pages: FirecrawlPageResult[];
  failedUrls?: CrawlErrorItem[];
  robotsBlockedUrls?: string[];
  success: boolean;
  error?: string;
  firecrawlJobId?: string;
}