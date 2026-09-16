export const JOB_EXPORT_SUBDIRS = {
  DATA: "data",
  DATA_RAW: "data/raw",
  DATA_CLEAN: "data/clean",
  MARKDOWN: "markdown",
  MARKDOWN_RAW: "markdown/raw",
  MARKDOWN_CLEAN: "markdown/clean",
  RAW: "raw",
  LOGS: "logs",
} as const;

export const UPLOAD_SUBDIRS = {
  AVATARS: "avatars",
} as const;

export const JOB_EXPORT_FILES = {
  METADATA: "metadata.json",
  SUMMARY: "summary.json",
  DATA_QUALITY_JSON: "data_quality.json",
  PAGES_JSON: "pages.json",
  PAGES_RAW_JSON: "pages.raw.json",
  PAGES_CLEAN_JSON: "pages.clean.json",
  PAGES_CSV: "pages.csv",
  LINKS_CSV: "links.csv",
  IMAGES_CSV: "images.csv",
  PAGES_XLSX: "pages.xlsx",
  TABLES_XLSX: "tables.xlsx",
  ERRORS_JSON: "errors.json",
  CRAWL_LOG: "crawl-log.txt",
  STRUCTURED_JSON: "structured.json",
  DIFF_REPORT_JSON: "diff_report.json",
} as const;

export function buildCrawlResultZipName(jobId: string): string {
  return `${jobId}.zip`;
}

export function buildCrawlResultZipKey(jobId: string): string {
  return `${jobId}/${buildCrawlResultZipName(jobId)}`;
}

export function buildMarkdownZipName(jobId: string): string {
  return "markdown.zip";
}

export function buildCsvZipName(jobId: string): string {
  return "csv.zip";
}

export function buildXlsxZipName(jobId: string): string {
  return "xlsx.zip";
}

export function buildJsonZipName(jobId: string): string {
  return "json.zip";
}
