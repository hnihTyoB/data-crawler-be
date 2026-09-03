export const EXPORT_TYPE = {
  JSON: "JSON",
  CSV: "CSV",
  XLSX: "XLSX",
  MARKDOWN: "MARKDOWN",
  ZIP: "ZIP",
} as const;

export type ExportType = keyof typeof EXPORT_TYPE;

export const EXPORT_MIME_TYPES: Record<ExportType, string> = {
  JSON: "application/json",
  CSV: "text/csv",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // MARKDOWN export tạo file .zip chứa nhiều file markdown — nên dùng application/zip
  MARKDOWN: "application/zip",
  ZIP: "application/zip",
};
