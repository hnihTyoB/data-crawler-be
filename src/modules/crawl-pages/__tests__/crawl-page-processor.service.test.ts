import { CrawlPageProcessorService } from "../crawl-page-processor.service";
import {
  mapCrawlError,
  isConnectionLossError,
} from "../../../common/helpers/error-mapping.helper";
import {
  FirecrawlPageResult,
  CrawlErrorItem,
} from "../../firecrawl/firecrawl.dto";

// ─────────────────────────────────────────────
// inferStatus()
// ─────────────────────────────────────────────

describe("CrawlPageProcessorService.inferStatus()", () => {
  const svc = new CrawlPageProcessorService();

  // No error — status from statusCode
  it("returns SUCCESS when no error and statusCode is 200", () => {
    expect(svc.inferStatus(undefined, 200)).toBe("SUCCESS");
  });

  it("returns SUCCESS when no error and statusCode is undefined", () => {
    expect(svc.inferStatus(undefined, undefined)).toBe("SUCCESS");
  });

  it("returns FAILED when no error string but statusCode >= 400", () => {
    expect(svc.inferStatus(undefined, 404)).toBe("FAILED");
    expect(svc.inferStatus(undefined, 500)).toBe("FAILED");
  });

  // BLOCKED — robots.txt
  it("returns BLOCKED for robots.txt error", () => {
    expect(svc.inferStatus("blocked by robots.txt", undefined)).toBe("BLOCKED");
  });

  it('returns BLOCKED for "blocked by robots" error', () => {
    expect(svc.inferStatus("blocked by robots", undefined)).toBe("BLOCKED");
  });

  it('returns BLOCKED for bare "robots" mention', () => {
    expect(svc.inferStatus("robots disallow", undefined)).toBe("BLOCKED");
  });

  // CAPTCHA_DETECTED
  it("returns CAPTCHA_DETECTED for captcha error", () => {
    expect(svc.inferStatus("captcha required", undefined)).toBe(
      "CAPTCHA_DETECTED",
    );
  });

  it("returns CAPTCHA_DETECTED for uppercase CAPTCHA", () => {
    expect(svc.inferStatus("CAPTCHA detected on page", undefined)).toBe(
      "CAPTCHA_DETECTED",
    );
  });

  // PAYWALL_DETECTED
  it("returns PAYWALL_DETECTED for paywall error", () => {
    expect(svc.inferStatus("paywall detected", undefined)).toBe(
      "PAYWALL_DETECTED",
    );
  });

  // REQUIRES_LOGIN
  it('returns REQUIRES_LOGIN for "requires login"', () => {
    expect(svc.inferStatus("page requires login", undefined)).toBe(
      "REQUIRES_LOGIN",
    );
  });

  it('returns REQUIRES_LOGIN for "login required"', () => {
    expect(svc.inferStatus("login required to view", undefined)).toBe(
      "REQUIRES_LOGIN",
    );
  });

  // TIMEOUT
  it("returns TIMEOUT for timeout error", () => {
    expect(svc.inferStatus("request timeout after 30s", undefined)).toBe(
      "TIMEOUT",
    );
  });

  it('returns TIMEOUT for "timed out"', () => {
    expect(svc.inferStatus("connection timed out", undefined)).toBe("TIMEOUT");
  });

  // BLOCKED — Cloudflare / WAF / rate limit / IP block
  it("returns BLOCKED for cloudflare error", () => {
    expect(svc.inferStatus("blocked by cloudflare", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for 403 error string", () => {
    expect(svc.inferStatus("received 403 response", undefined)).toBe("BLOCKED");
  });

  it('returns BLOCKED for "access denied"', () => {
    expect(svc.inferStatus("access denied", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for private ip error", () => {
    expect(svc.inferStatus("private ip blocked", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for private_ip_blocked", () => {
    expect(svc.inferStatus("private_ip_blocked", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for rate limit error", () => {
    expect(svc.inferStatus("rate limit exceeded", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for 429 error string", () => {
    expect(svc.inferStatus("429 too many requests", undefined)).toBe("BLOCKED");
  });

  it('returns BLOCKED for "too many requests"', () => {
    expect(svc.inferStatus("too many requests from this IP", undefined)).toBe(
      "BLOCKED",
    );
  });

  it('returns BLOCKED for "forbidden" without key mention', () => {
    expect(svc.inferStatus("forbidden", undefined)).toBe("BLOCKED");
  });

  it("returns BLOCKED for bot block", () => {
    expect(svc.inferStatus("ip bot blocked", undefined)).toBe("BLOCKED");
  });

  // FAILED — API key errors must NOT become BLOCKED
  it("returns FAILED for api key error (not BLOCKED)", () => {
    expect(svc.inferStatus("unauthorized api key", undefined)).toBe("FAILED");
  });

  it("returns FAILED for apikey error", () => {
    expect(svc.inferStatus("invalid apikey provided", undefined)).toBe(
      "FAILED",
    );
  });

  it('returns FAILED for "forbidden" combined with "key"', () => {
    expect(svc.inferStatus("forbidden: invalid api key", undefined)).toBe(
      "FAILED",
    );
  });

  // FAILED — generic / unknown
  it("returns FAILED for DNS error", () => {
    expect(svc.inferStatus("dns enotfound example.com", undefined)).toBe(
      "FAILED",
    );
  });

  it("returns FAILED for unknown error string", () => {
    expect(svc.inferStatus("something went wrong", undefined)).toBe("FAILED");
  });

  // Error string takes priority over statusCode
  it("error string takes priority over statusCode — captcha overrides 200", () => {
    expect(svc.inferStatus("captcha detected", 200)).toBe("CAPTCHA_DETECTED");
  });

  it("error string takes priority over statusCode — blocked overrides 403", () => {
    expect(svc.inferStatus("cloudflare block", 403)).toBe("BLOCKED");
  });
});

// ─────────────────────────────────────────────
// mapCrawlError()
// ─────────────────────────────────────────────

describe("mapCrawlError()", () => {
  it("returns generic message for null input", () => {
    expect(mapCrawlError(null)).toContain("Lỗi không xác định");
  });

  it("returns generic message for undefined input", () => {
    expect(mapCrawlError(undefined)).toContain("Lỗi không xác định");
  });

  it("maps robots.txt error to Vietnamese message", () => {
    const msg = mapCrawlError("blocked by robots.txt");
    expect(msg).toContain("robots.txt");
  });

  it("maps captcha error to Vietnamese message", () => {
    const msg = mapCrawlError("captcha required");
    expect(msg).toContain("CAPTCHA");
  });

  it("maps requires login error", () => {
    const msg = mapCrawlError("requires login");
    expect(msg).toContain("đăng nhập");
  });

  it("maps paywall error", () => {
    const msg = mapCrawlError("paywall detected");
    expect(msg).toContain("paywall");
  });

  it("maps API key / unauthorized error", () => {
    const msg = mapCrawlError("unauthorized api key");
    expect(msg).toContain("API Key");
  });

  it("maps timeout error", () => {
    const msg = mapCrawlError("request timed out");
    expect(msg).toContain("Timeout");
  });

  it("maps cloudflare / 403 / forbidden error", () => {
    const msg = mapCrawlError("blocked by cloudflare");
    expect(msg).toContain("Cloudflare");
  });

  it("maps DNS / invalid URL error", () => {
    const msg = mapCrawlError("dns enotfound example.com");
    expect(msg).toContain("URL");
  });

  it("maps rate limit / 429 error", () => {
    const msg = mapCrawlError("429 too many requests");
    expect(msg).toContain("Rate Limit");
  });

  it("maps private IP block error", () => {
    const msg = mapCrawlError("private_ip_blocked");
    expect(msg).toContain("Cloudflare");
  });

  it("returns fallback message for unknown error", () => {
    const msg = mapCrawlError("something completely unknown");
    expect(msg).toContain("Vui lòng thử lại");
  });
});

describe("isConnectionLossError()", () => {
  it("detects timeout errors", () => {
    expect(isConnectionLossError("request timed out")).toBe(true);
    expect(isConnectionLossError("ETIMEDOUT 10.0.0.1")).toBe(true);
    expect(isConnectionLossError("ESOCKETTIMEDOUT")).toBe(true);
    expect(isConnectionLossError("Kết nối đến trang web đích bị quá thời gian (Timeout). Trang web phản hồi quá chậm.")).toBe(true);
  });

  it("detects connection resets and network errors", () => {
    expect(isConnectionLossError("read ECONNRESET")).toBe(true);
    expect(isConnectionLossError("connect ECONNREFUSED 127.0.0.1")).toBe(true);
    expect(isConnectionLossError("socket hang up")).toBe(true);
    expect(isConnectionLossError("network error occurred")).toBe(true);
    expect(isConnectionLossError("Mất kết nối với máy chủ đích")).toBe(true);
  });

  it("detects DNS lookup errors", () => {
    expect(isConnectionLossError("getaddrinfo ENOTFOUND api.example.com")).toBe(true);
    expect(isConnectionLossError("dns lookup failure")).toBe(true);
    expect(isConnectionLossError("không thể phân giải tên miền")).toBe(true);
  });

  it("returns false for non-connection errors", () => {
    expect(isConnectionLossError(null)).toBe(false);
    expect(isConnectionLossError(undefined)).toBe(false);
    expect(isConnectionLossError("")).toBe(false);
    expect(isConnectionLossError("blocked by robots.txt")).toBe(false);
    expect(isConnectionLossError("captcha required")).toBe(false);
    expect(isConnectionLossError("paywall detected")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// normalize() — status/errorMessage consistency
// ─────────────────────────────────────────────

describe("CrawlPageProcessorService.normalize()", () => {
  const svc = new CrawlPageProcessorService();

  const basePage: FirecrawlPageResult = {
    url: "https://example.com/page",
    title: "Example",
    description: "A test page",
    markdown: "# Example\n\nContent here for testing purposes only.",
    statusCode: 200,
    success: true,
  };

  it("sets status SUCCESS for a clean successful page", () => {
    const result = svc.normalize(basePage, "job-1");
    expect(result.status).toBe("SUCCESS");
    expect(result.errorMessage).toBeUndefined();
  });

  it("sets status CAPTCHA_DETECTED and errorMessage for captcha page", () => {
    const page: FirecrawlPageResult = {
      ...basePage,
      success: false,
      error: "captcha required",
    };
    const result = svc.normalize(page, "job-1");
    expect(result.status).toBe("CAPTCHA_DETECTED");
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain("CAPTCHA");
  });

  it("sets status BLOCKED for cloudflare error", () => {
    const page: FirecrawlPageResult = {
      ...basePage,
      success: false,
      error: "blocked by cloudflare WAF",
    };
    const result = svc.normalize(page, "job-1");
    expect(result.status).toBe("BLOCKED");
  });

  it("sets status BLOCKED for rate limit error", () => {
    const page: FirecrawlPageResult = {
      ...basePage,
      success: false,
      error: "rate limit exceeded",
    };
    const result = svc.normalize(page, "job-1");
    expect(result.status).toBe("BLOCKED");
  });

  it("sets status FAILED (not BLOCKED) for api key error", () => {
    const page: FirecrawlPageResult = {
      ...basePage,
      success: false,
      error: "forbidden: invalid api key",
    };
    const result = svc.normalize(page, "job-1");
    expect(result.status).toBe("FAILED");
  });

  it("status and errorMessage are consistent — same error pattern", () => {
    const rawError = "blocked by robots.txt";
    const page: FirecrawlPageResult = {
      ...basePage,
      success: false,
      error: rawError,
    };
    const result = svc.normalize(page, "job-1");
    // Both inferStatus and mapCrawlError should handle robots.txt
    expect(result.status).toBe("BLOCKED");
    expect(result.errorMessage).toContain("robots.txt");
  });

  it("computes wordCount from cleaned content", () => {
    const result = svc.normalize(basePage, "job-1");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("sets contentHash when content exists", () => {
    const result = svc.normalize(basePage, "job-1");
    expect(result.contentHash).toBeDefined();
    expect(typeof result.contentHash).toBe("string");
  });

  it("wordCount is 0 and contentHash undefined for empty markdown", () => {
    const page: FirecrawlPageResult = { ...basePage, markdown: "" };
    const result = svc.normalize(page, "job-1");
    expect(result.wordCount).toBe(0);
    expect(result.contentHash).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// normalizeFailedPage()
// ─────────────────────────────────────────────

describe("CrawlPageProcessorService.normalizeFailedPage()", () => {
  const svc = new CrawlPageProcessorService();

  const errorItem: CrawlErrorItem = {
    url: "https://example.com/blocked",
    error: "blocked by robots.txt",
  };

  it("infers status from error when no status override given", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1");
    expect(result.status).toBe("BLOCKED");
  });

  it("uses provided status override", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1", "SKIPPED");
    expect(result.status).toBe("SKIPPED");
  });

  it("always sets errorMessage", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1");
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage!.length).toBeGreaterThan(0);
  });

  it("always sets wordCount to 0", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1");
    expect(result.wordCount).toBe(0);
  });

  it("always sets warnings to empty array", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1");
    expect(result.warnings).toEqual([]);
  });

  it("normalizes URL", () => {
    const result = svc.normalizeFailedPage(errorItem, "job-1");
    expect(result.normalizedUrl).toBe("https://example.com/blocked");
  });
});
