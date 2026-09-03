export const CRAWL_MODE = {
  SCRAPE: "SCRAPE",
  CRAWL: "CRAWL",
  SITEMAP: "SITEMAP",
  URL_LIST: "URL_LIST",
} as const;

export const CRAWL_MODES = CRAWL_MODE;

export type CrawlMode = keyof typeof CRAWL_MODE;
