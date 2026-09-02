/**
 * DATA CONTRACT v1
 * Định nghĩa cấu trúc chuẩn của một CrawlPage record khi được export ra file.
 * Mọi định dạng export (JSON, CSV, XLSX, Markdown, ZIP) đều phải tuân thủ contract này.
 *
 * @schemaVersion 1
 * @lastUpdated 2026-07-15
 */

// ─────────────────────────────────────────────
// Warning Types
// ─────────────────────────────────────────────

/**
 * Danh sách các cảnh báo chất lượng dữ liệu có thể xảy ra với một page.
 * - NAV_NOISE    : Nội dung chủ yếu là navigation / menu / footer, ít giá trị thực.
 * - TOO_SHORT    : Nội dung quá ngắn (wordCount < ngưỡng tối thiểu).
 * - DUPLICATE_CONTENT : Hash nội dung trùng với page khác trong cùng job.
 * - MISSING_TITLE     : Trang không có thẻ <title>.
 * - MISSING_DESCRIPTION : Trang không có meta description.
 * - LOW_QUALITY_SCORE  : dataQualityScore < ngưỡng cho phép.
 */
export type DataQualityWarning =
  | 'NAV_NOISE'
  | 'TOO_SHORT'
  | 'DUPLICATE_CONTENT'
  | 'MISSING_TITLE'
  | 'MISSING_DESCRIPTION'
  | 'LOW_QUALITY_SCORE';

// ─────────────────────────────────────────────
// Asset Sub-Records
// ─────────────────────────────────────────────

export interface LinkRecord {
  /** URL đích của link */
  url: string;
  /** URL của trang chứa link này */
  sourceUrl: string;
  /** Phân loại: internal (cùng domain) hoặc external */
  type: 'internal' | 'external';
}

export interface ImageRecord {
  /** URL tuyệt đối của ảnh */
  sourceUrl: string;
  /** Alt text của thẻ <img> */
  altText: string | null;
  /** Thứ tự xuất hiện trong trang (1-based) */
  orderIndex: number;
  /** MIME type hoặc phần mở rộng file ảnh */
  type: string;
}

export interface TableRecord {
  /** Vị trí 0-based của bảng trong page */
  tableIndex: number;
  /** Các tiêu đề cột */
  headers: string[];
  /** Tổng số hàng dữ liệu */
  rowsCount: number;
  /** Tổng số cột */
  colsCount: number;
  /** Tên worksheet tương ứng trong tables.xlsx */
  sheetName: string;
}

// ─────────────────────────────────────────────
// Core Record — CrawlPage
// ─────────────────────────────────────────────

/**
 * Một record CrawlPage đã được chuẩn hóa theo Data Contract v1.
 * Đây là unit dữ liệu cơ bản được dùng trong tất cả các định dạng export.
 */
export interface CrawlPageRecord {
  /** UUID của CrawlPage trong DB */
  id: string;

  /** UUID của CrawlJob cha */
  jobId: string;

  /** URL gốc đã crawl */
  url: string;

  /**
   * URL đã được normalize (lowercase scheme/host, bỏ trailing slash,
   * loại bỏ fragment, sắp xếp query params).
   * Dùng để deduplicate và so sánh.
   */
  normalizedUrl: string;

  /** Trạng thái crawl của page */
  status: CrawlPageStatus;

  /** HTTP status code. Bắt buộc kiểu number | null, không dùng string. */
  statusCode: number | null;

  /** Thông báo lỗi thân thiện (đã được map qua error-mapping.helper) */
  errorMessage: string | null;

  // ── Content fields ──

  /** Tiêu đề trang (từ <title>) */
  title: string | null;

  /** Meta description */
  description: string | null;

  /**
   * Nội dung Markdown thô (raw) — chưa lọc, giữ nguyên navigation/footer.
   * Dùng cho debug.
   */
  rawMarkdown: string | null;

  /**
   * Nội dung text thuần, đã strip toàn bộ Markdown syntax.
   * Dùng để đếm từ và tính toán chất lượng.
   */
  cleanText: string | null;

  /**
   * Nội dung chính của trang, đã lọc bỏ noise (nav, footer, sidebar).
   * Đây là trường ưu tiên để training AI.
   */
  mainContent: string | null;

  // ── Quality metrics ──

  /** Số từ trong cleanText */
  wordCount: number;

  /**
   * SHA-256 hash của cleanText, dùng để phát hiện nội dung trùng lặp.
   * null nếu không có nội dung.
   */
  contentHash: string | null;

  /**
   * Điểm chất lượng dữ liệu từ 0–100.
   * null nếu chưa được tính (page bị lỗi).
   */
  dataQualityScore: number | null;

  /** Danh sách cảnh báo chất lượng dữ liệu của page này */
  warnings: DataQualityWarning[];

  // ── Asset collections ──

  /** Danh sách link thu thập được từ trang */
  links: LinkRecord[];

  /** Danh sách ảnh thu thập được từ trang */
  images: ImageRecord[];

  /** Danh sách bảng HTML thu thập được từ trang */
  tables: TableRecord[];

  // ── Timestamps ──

  /** Thời điểm page được crawl xong (ISO 8601) */
  crawledAt: string | null;
}

/**
 * Trạng thái crawl của một page — mirror từ Prisma enum CrawlPageStatus.
 * Định nghĩa lại ở đây để Data Contract không phụ thuộc trực tiếp vào Prisma.
 */
export type CrawlPageStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'BLOCKED'
  | 'TIMEOUT'
  | 'CAPTCHA_DETECTED'
  | 'PAYWALL_DETECTED'
  | 'REQUIRES_LOGIN'
  | 'SKIPPED';

// ─────────────────────────────────────────────
// Export Envelope
// ─────────────────────────────────────────────

/**
 * Wrapper object cho file pages.json — bao gồm metadata về schema
 * và mảng các CrawlPageRecord.
 */
export interface PagesJsonEnvelope<TPage = CrawlPageRecord> {
  /** Phiên bản schema, tăng lên mỗi khi có breaking change */
  schemaVersion: string;
  /** ID của CrawlJob */
  jobId: string;
  /** Tổng số record trong mảng pages */
  totalRecords: number;
  /** Thời điểm file được tạo (ISO 8601) */
  exportedAt: string;
  /** Dữ liệu các page */
  pages: TPage[];
}
