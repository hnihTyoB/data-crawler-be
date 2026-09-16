export const EXPORT_TYPE = {
  JSON: "JSON",
  CSV: "CSV",
  XLSX: "XLSX",
  MARKDOWN: "MARKDOWN",
  ZIP: "ZIP",
} as const;

export type ExportType = keyof typeof EXPORT_TYPE;

export const EXPORT_MIME_TYPES: Record<ExportType, string> = {
  // JSON export tạo file .zip chứa các file JSON (pages.json, clean/pages.clean.json, raw/pages.raw.json, structured.json)
  JSON: "application/zip",
  // CSV export tạo file .zip chứa các file CSV (pages.csv, links.csv, images.csv)
  CSV: "application/zip",
  // XLSX export tạo file .zip chứa các file Excel (pages.xlsx, tables.xlsx)
  XLSX: "application/zip",
  // MARKDOWN export tạo file .zip chứa nhiều file markdown — nên dùng application/zip
  MARKDOWN: "application/zip",
  ZIP: "application/zip",
};
export const EXPORT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ExportStatus = keyof typeof EXPORT_STATUS;
