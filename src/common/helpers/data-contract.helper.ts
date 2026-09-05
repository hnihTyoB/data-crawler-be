import crypto from "crypto";
import { CrawlPage, CrawlAsset } from "../types/database.types";
import {
  CrawlPageRecord,
  DataQualityWarning,
  LinkRecord,
  ImageRecord,
  TableRecord,
  PagesJsonEnvelope,
} from "../types/data-contract.types";
import {
  DATA_CONTRACT_SCHEMA_VERSION,
  DATA_QUALITY_MIN_WORD_COUNT,
  DATA_QUALITY_MIN_SCORE,
  DATA_CONTRACT_HASH_ALGORITHM,
} from "../constants/data-contract.constant";
import { ASSET_TYPE } from "../constants/asset-type.constant";
import { CRAWL_PAGE_STATUS } from "../constants/crawl-page-status.constant";

/**
 * Normalize một URL để phục vụ deduplicate và so sánh.
 * Các bước:
 *  1. Lowercase scheme và host.
 *  2. Bỏ fragment (#...).
 *  3. Bỏ trailing slash ở pathname.
 *  4. Sắp xếp query params theo alphabet.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.protocol = parsed.protocol.toLowerCase();

    // Bỏ trailing slash ở pathname (trừ root '/')
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Filter out common tracking query parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    const filteredEntries = [...parsed.searchParams.entries()]
      .filter(([key]) => !trackingParams.includes(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));

    // Sắp xếp query params
    const sortedParams = new URLSearchParams(filteredEntries);
    parsed.search = sortedParams.toString()
      ? `?${sortedParams.toString()}`
      : "";

    return parsed.toString();
  } catch {
    // URL không hợp lệ → trả về nguyên bản
    return rawUrl;
  }
}

/**
 * Strip toàn bộ Markdown syntax, trả về plain text thuần.
 * Phạm vi: heading, bold/italic, inline code, code block, link, image, blockquote, HR.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links → link text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/^[-*]{3,}$/gm, "") // horizontal rules
    .replace(/^\s*[-*+]\s+/gm, "") // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines
    .trim();
}

/**
 * Lọc bỏ các khối menu điều hướng (nav) và bản quyền footer (copyright).
 */
export function extractMainContent(
  markdown: string | null | undefined,
): string {
  if (!markdown) return "";

  const lines = markdown.split("\n");

  // Count line frequency to detect repeated boilerplate
  const lineFrequency = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      lineFrequency.set(trimmed, (lineFrequency.get(trimmed) ?? 0) + 1);
    }
  }

  const NAV_KEYWORDS = [
    "home",
    "about",
    "about us",
    "contact",
    "contact us",
    "privacy",
    "privacy policy",
    "terms",
    "terms of service",
    "terms of use",
    "careers",
    "login",
    "signin",
    "signup",
    "register",
    "copyright",
    "help",
    "faq",
    "blog",
    "news",
    "search",
    "cart",
    "checkout",
    "account",
    "profile",
    "settings",
    "logout",
    "sign out",
    "subscribe",
    "newsletter",
  ];

  const SOCIAL_KEYWORDS = [
    "twitter",
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "tiktok",
    "pinterest",
    "snapchat",
    "reddit",
    "github",
    "telegram",
    "whatsapp",
    "zalo",
  ];

  const SIDEBAR_PATTERNS = [
    /^#{1,3}\s*(related|popular|trending|recommended|recent|latest|top)\s/i,
    /^#{1,3}\s*(tags?|categories|category|archive|archives)\s*$/i,
    /^#{1,3}\s*(newsletter|subscribe|follow us|share|advertisement)\s*$/i,
    /^#{1,3}\s*(sidebar|widget)\s*$/i,
  ];

  const FOOTER_PATTERNS = [
    /^\*?\*?©/,
    /copyright\s*©/i,
    /all rights reserved/i,
    /^\s*\+?\d[\d\s\-().]{6,}\d\s*$/, // phone numbers
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\s*$/, // standalone email
  ];

  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();

    // Remove repeated lines (appear 3+ times — boilerplate)
    if (trimmed.length > 0 && (lineFrequency.get(trimmed) ?? 0) >= 3) {
      return false;
    }

    // Remove footer patterns
    for (const pattern of FOOTER_PATTERNS) {
      if (pattern.test(trimmed)) return false;
    }

    // Remove sidebar section headers
    for (const pattern of SIDEBAR_PATTERNS) {
      if (pattern.test(trimmed)) return false;
    }

    // Remove nav/social list items: * [Text](url) or - [Text](url)
    if (trimmed.startsWith("* [") || trimmed.startsWith("- [")) {
      const match = trimmed.match(/^[\*\-]\s+\[(.*?)\]/);
      if (match) {
        const linkText = match[1].trim().toLowerCase();

        if (NAV_KEYWORDS.includes(linkText)) return false;
        if (SOCIAL_KEYWORDS.some((s) => linkText.includes(s))) return false;

        // Remove very short nav-like link texts (1–2 words, likely menu items)
        // only if it is a standalone link at the end of the line
        const wordCount = linkText.split(/\s+/).filter(Boolean).length;
        if (wordCount <= 2 && trimmed.match(/\]\([^)]+\)$/)) return false;
      }
    }

    return true;
  });

  return cleanedLines.join("\n").trim();
}

/**
 * Đếm số từ trong một chuỗi plain text.
 * Tách bằng khoảng trắng/xuống dòng, lọc bỏ phần tử rỗng.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Tạo SHA-256 hex hash của một chuỗi.
 * Trả về null nếu chuỗi rỗng.
 */
export function hashContent(text: string): string | null {
  if (!text.trim()) return null;
  return crypto
    .createHash(DATA_CONTRACT_HASH_ALGORITHM)
    .update(text)
    .digest("hex");
}

/**
 * Tính điểm chất lượng dữ liệu (0–100) của một page dựa trên các tiêu chí:
 * - Có mainContent       : +40 điểm
 * - wordCount >= ngưỡng  : +30 điểm
 * - Có title             : +15 điểm
 * - Có description       : +15 điểm
 *
 * Trả về null nếu page bị lỗi (status !== SUCCESS).
 */
export function calcDataQualityScore(params: {
  isSuccess: boolean;
  mainContent: string | null;
  wordCount: number;
  title: string | null;
  description: string | null;
}): number | null {
  if (!params.isSuccess) return null;

  let score = 0;
  if (params.mainContent) score += 40;
  if (params.wordCount >= DATA_QUALITY_MIN_WORD_COUNT) score += 30;
  if (params.title) score += 15;
  if (params.description) score += 15;

  return score;
}

/**
 * Phát hiện danh sách cảnh báo chất lượng dữ liệu cho một page.
 */
export function detectWarnings(params: {
  title: string | null;
  description: string | null;
  wordCount: number;
  dataQualityScore: number | null;
  isDuplicateContent: boolean;
  isNavNoise: boolean;
}): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = [];

  if (!params.title) warnings.push("MISSING_TITLE");
  if (!params.description) warnings.push("MISSING_DESCRIPTION");
  if (params.wordCount < DATA_QUALITY_MIN_WORD_COUNT && params.wordCount > 0) {
    warnings.push("TOO_SHORT");
  }
  if (params.isDuplicateContent) warnings.push("DUPLICATE_CONTENT");
  if (params.isNavNoise) warnings.push("NAV_NOISE");
  if (
    params.dataQualityScore !== null &&
    params.dataQualityScore < DATA_QUALITY_MIN_SCORE
  ) {
    warnings.push("LOW_QUALITY_SCORE");
  }

  return warnings;
}

/**
 * Chuyển đổi danh sách CrawlAsset sang LinkRecord[].
 * Phân loại internal/external dựa vào domain của startUrl (job's domain).
 */
export function transformLinks(
  assets: CrawlAsset[],
  jobDomain: string,
): LinkRecord[] {
  return assets
    .filter((a) => a.assetType === "LINK")
    .map((a) => {
      let type: "internal" | "external" = "external";
      try {
        const linkHostname = new URL(a.url).hostname;
        if (
          linkHostname === jobDomain ||
          linkHostname.endsWith(`.${jobDomain}`)
        ) {
          type = "internal";
        }
      } catch {
        // URL không hợp lệ → giữ external
      }
      return {
        url: a.url,
        sourceUrl: a.sourceUrl ?? "",
        type,
      };
    });
}

/**
 * Chuyển đổi danh sách CrawlAsset sang ImageRecord[].
 */
export function transformImages(assets: CrawlAsset[]): ImageRecord[] {
  const seenUrls = new Set<string>();
  return assets
    .filter((a) => {
      if (a.assetType !== ASSET_TYPE.IMAGE) return false;
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    })
    .map((a, index) => ({
      sourceUrl: a.url,
      altText: a.altText ?? null,
      orderIndex: a.orderIndex ?? index + 1,
      type: a.mimeType ?? inferImageType(a.url),
    }));
}

function inferImageType(imageUrl: string): string {
  try {
    const extension = new URL(imageUrl).pathname.match(
      /\.([a-zA-Z0-9]+)$/,
    )?.[1];
    return extension?.toLowerCase() ?? "unknown";
  } catch {
    return "unknown";
  }
}

export interface TransformPageOptions {
  page: CrawlPage & { normalizedUrl?: string | null };
  assets: CrawlAsset[];
  tables?: TableRecord[];
  /** Domain của job (hostname) để phân loại internal/external link */
  jobDomain: string;
  /** Set chứa contentHash của các page đã xử lý trước đó — dùng để phát hiện duplicate */
  seenContentHashes: Set<string>;
}

/**
 * Chuyển đổi một CrawlPage (Prisma record) thành CrawlPageRecord theo Data Contract v1.
 *
 * Lưu ý: Hàm này sẽ thêm contentHash vào seenContentHashes nếu không phải duplicate.
 */
export function transformPageToRecord(
  options: TransformPageOptions,
): CrawlPageRecord {
  const { page, assets, tables = [], jobDomain, seenContentHashes } = options;

  const normalizedUrl = page.normalizedUrl || normalizeUrl(page.url);
  const isSuccess = page.status === CRAWL_PAGE_STATUS.SUCCESS;

  // Clean text từ markdownContent
  const rawMarkdown = page.markdownContent ?? null;
  const mainContent = extractMainContent(rawMarkdown) || null;
  const cleanText = mainContent ? stripMarkdown(mainContent) : null;
  const wordCount = cleanText ? countWords(cleanText) : 0;
  const contentHash = cleanText ? hashContent(cleanText) : null;

  // Determine Nav Noise
  const originalLinesCount = rawMarkdown ? rawMarkdown.split("\n").length : 0;
  const mainLinesCount = mainContent ? mainContent.split("\n").length : 0;
  const isNavNoise =
    originalLinesCount > 10 &&
    (originalLinesCount - mainLinesCount) / originalLinesCount > 0.3;

  // Phát hiện duplicate
  const isDuplicateContent =
    contentHash !== null && seenContentHashes.has(contentHash);
  if (contentHash && !isDuplicateContent) {
    seenContentHashes.add(contentHash);
  }

  // Tính quality score
  const dataQualityScore = calcDataQualityScore({
    isSuccess,
    mainContent,
    wordCount,
    title: page.title ?? null,
    description: page.description ?? null,
  });

  // Phát hiện warnings
  const warnings = detectWarnings({
    title: page.title ?? null,
    description: page.description ?? null,
    wordCount,
    dataQualityScore,
    isDuplicateContent,
    isNavNoise,
  });

  return {
    id: page.id,
    jobId: page.jobId,
    url: page.url,
    normalizedUrl,
    status: page.status as CrawlPageRecord["status"],
    statusCode: page.statusCode ?? null,
    errorMessage: page.errorMessage ?? null,
    title: page.title ?? null,
    description: page.description ?? null,
    rawMarkdown,
    cleanText,
    mainContent,
    wordCount,
    contentHash,
    dataQualityScore,
    warnings,
    links: transformLinks(assets, jobDomain),
    images: transformImages(assets),
    tables,
    crawledAt: page.crawledAt?.toISOString() ?? null,
  };
}

/**
 * Đóng gói danh sách CrawlPageRecord vào PagesJsonEnvelope để ghi ra pages.json.
 */
export function buildPagesJsonEnvelope<TPage>(
  jobId: string,
  pages: TPage[],
): PagesJsonEnvelope<TPage> {
  return {
    schemaVersion: DATA_CONTRACT_SCHEMA_VERSION,
    jobId,
    totalRecords: pages.length,
    exportedAt: new Date().toISOString(),
    pages,
  };
}
