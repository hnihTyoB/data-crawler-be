/**
 * Helper chuẩn hóa (map) các thông báo lỗi crawl thô từ Firecrawl hoặc hệ thống
 * sang các thông điệp dễ hiểu bằng tiếng Việt cho frontend.
 */
export function mapCrawlError(rawError: string | null | undefined): string {
  if (!rawError) {
    return "Lỗi không xác định trong quá trình cào dữ liệu.";
  }

  const err = rawError.toLowerCase();

  // 1. Chặn bởi robots.txt
  if (
    err.includes("robots.txt") ||
    err.includes("blocked by robots") ||
    err.includes("robots blocked")
  ) {
    return "Trang web đích ngăn chặn việc cào dữ liệu thông qua tệp robots.txt.";
  }

  // 2. CAPTCHA
  if (err.includes("captcha")) {
    return "Trang web đích yêu cầu xác minh CAPTCHA. Hệ thống không thể bypass — trang được đánh dấu CAPTCHA_DETECTED.";
  }

  // 3. Yêu cầu đăng nhập
  if (err.includes("requires login") || err.includes("login required")) {
    return "Trang web đích yêu cầu đăng nhập. Hệ thống không thể truy cập nội dung — trang được đánh dấu REQUIRES_LOGIN.";
  }

  // 4. Paywall
  if (err.includes("paywall")) {
    return "Trang web đích được bảo vệ bởi paywall (nội dung trả phí). Hệ thống không thể truy cập — trang được đánh dấu PAYWALL_DETECTED.";
  }

  // 5. Lỗi API Key / Xác thực / Hạn mức Provider
  if (
    err.includes("unauthorized") ||
    err.includes("api key") ||
    err.includes("apikey") ||
    err.includes("credit") ||
    err.includes("402") ||
    (err.includes("forbidden") && err.includes("key"))
  ) {
    return "Lỗi xác thực hệ thống cào dữ liệu (API Key không hợp lệ, hết hạn hoặc vượt quá giới hạn gói dịch vụ).";
  }

  // 6. Timeout
  if (err.includes("timeout") || err.includes("timed out")) {
    return "Kết nối đến trang web đích bị quá thời gian (Timeout). Trang web phản hồi quá chậm.";
  }

  // 7. Chặn bởi Cloudflare / Security / IP Blocked
  if (
    err.includes("cloudflare") ||
    err.includes("403") ||
    err.includes("forbidden") ||
    err.includes("access denied") ||
    (err.includes("block") && (err.includes("ip") || err.includes("bot")))
  ) {
    return "Yêu cầu bị từ chối. Trang web đích chặn kết nối cào dữ liệu (chặn IP, phát hiện bot hoặc bảo vệ bởi Cloudflare/WAF).";
  }

  // 8. DNS / URL không đúng / Không tìm thấy host
  if (
    err.includes("dns") ||
    err.includes("getaddrinfo") ||
    err.includes("enotfound") ||
    err.includes("invalid url") ||
    err.includes("cannot parse url")
  ) {
    return "Địa chỉ URL không hợp lệ hoặc không thể phân giải tên miền (trang web không tồn tại hoặc sai đường dẫn).";
  }

  // 9. Rate limit / 429
  if (
    err.includes("rate limit") ||
    err.includes("429") ||
    err.includes("too many requests")
  ) {
    return "Yêu cầu bị từ chối do tần suất truy cập vượt quá giới hạn cho phép (Rate Limit). Vui lòng thử lại sau.";
  }

  // 10. Chặn IP Private (SSRF Protection)
  if (err.includes("private ip") || err.includes("private_ip_blocked")) {
    return "Không được phép cào dữ liệu từ địa chỉ IP nội bộ hoặc mạng nội bộ (SSRF Protection).";
  }

  // Fallback: không khớp bất kỳ pattern nào — trả về message tổng quát
  // Raw error được log ở tầng worker, không expose technical detail lên frontend
  return "Đã xảy ra lỗi trong quá trình cào dữ liệu. Vui lòng thử lại hoặc kiểm tra URL đích.";
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

/**
 * Kiểm tra xem lỗi cào dữ liệu có phải do mất kết nối mạng, timeout hoặc không thể truy cập host hay không.
 * Các tác vụ thất bại do lỗi kết nối sẽ được miễn trừ và không tính vào hạn mức sử dụng (Quota) của người dùng.
 */
export function isConnectionLossError(
  rawError: string | null | undefined,
): boolean {
  if (!rawError) {
    return false;
  }

  const err = rawError.toLowerCase();

  return (
    // Timeout / quá thời gian chờ kết nối
    err.includes("timeout") ||
    err.includes("timed out") ||
    err.includes("etimedout") ||
    err.includes("esockettimedout") ||
    // Lỗi đứt kết nối mạng, reset hoặc từ chối kết nối
    err.includes("econnrefused") ||
    err.includes("econnreset") ||
    err.includes("econnaborted") ||
    err.includes("network error") ||
    err.includes("network_error") ||
    err.includes("connection reset") ||
    err.includes("connection refused") ||
    err.includes("connection lost") ||
    err.includes("connection closed") ||
    err.includes("connection error") ||
    err.includes("socket hang up") ||
    err.includes("network is unreachable") ||
    err.includes("host unreachable") ||
    err.includes("offline") ||
    // Lỗi DNS / không tìm thấy host
    err.includes("dns") ||
    err.includes("getaddrinfo") ||
    err.includes("enotfound") ||
    // Lỗi từ nhà cung cấp cào / proxy / gateway (402, 500, 502, 503, 504, credit, bad gateway)
    err.includes("402") ||
    err.includes("credit") ||
    err.includes("500") ||
    err.includes("502") ||
    err.includes("503") ||
    err.includes("504") ||
    err.includes("bad gateway") ||
    err.includes("gateway") ||
    err.includes("service unavailable") ||
    // Các thông báo tiếng Việt tương ứng
    err.includes("mất kết nối") ||
    err.includes("lỗi kết nối") ||
    err.includes("không thể kết nối") ||
    err.includes("kết nối đến trang web đích bị quá thời gian") ||
    err.includes("không thể phân giải tên miền") ||
    err.includes("đã xảy ra lỗi trong quá trình cào dữ liệu") ||
    err.includes("lỗi không xác định") ||
    err.includes("lỗi xác thực hệ thống cào dữ liệu")
  );
}

