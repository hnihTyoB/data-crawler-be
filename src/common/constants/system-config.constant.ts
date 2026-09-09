export const SYSTEM_CONFIG_CATEGORY = {
  GENERAL: "GENERAL",
  FEATURE_FLAG: "FEATURE_FLAG",
  INTEGRATION: "INTEGRATION",
  SECURITY: "SECURITY",
} as const;

export type SystemConfigCategory =
  (typeof SYSTEM_CONFIG_CATEGORY)[keyof typeof SYSTEM_CONFIG_CATEGORY];

export const SYSTEM_CONFIG_EVENTS_CHANNEL = "system_config:events";

export const SYSTEM_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface DefaultSystemConfigItem {
  key: string;
  value: unknown;
  category: SystemConfigCategory;
  isPublic: boolean;
  description?: string;
}

export const DEFAULT_SYSTEM_CONFIGS: readonly DefaultSystemConfigItem[] = [
  // ==========================================
  // 1. GENERAL (Cấu hình chung, Ứng dụng & Lưu trữ)
  // ==========================================
  {
    key: "app.name",
    value: "Data Crawler Studio",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
    description: "Tên ứng dụng hiển thị công khai trên hệ thống và thông báo",
  },
  {
    key: "app.description",
    value: "Nền tảng cào dữ liệu web, trích xuất cấu trúc và theo dõi biến động nội dung thông minh",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
    description: "Mô tả giới thiệu hệ thống cho người dùng và các công cụ tìm kiếm",
  },
  {
    key: "app.frontend_url",
    value: "http://localhost:3000",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
    description: "Địa chỉ Web Frontend điều hướng liên kết và callback xác thực (FRONTEND_URL)",
  },
  {
    key: "app.support_email",
    value: "support@datacrawler.com",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
    description: "Hộp thư hỗ trợ kỹ thuật và chăm sóc người dùng hiển thị công khai",
  },
  {
    key: "app.timezone",
    value: "Asia/Ho_Chi_Minh",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
    description: "Múi giờ mặc định xử lý tác vụ và lịch biểu thu thập dữ liệu",
  },
  {
    key: "crawler.max_pages_default",
    value: 100,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Số lượng trang cào tối đa mặc định cho một tác vụ cào dữ liệu (MAX_CRAWL_PAGES)",
  },
  {
    key: "crawler.max_depth_default",
    value: 3,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Độ sâu liên kết tối đa mặc định khi thu thập dữ liệu web (MAX_CRAWL_DEPTH)",
  },
  {
    key: "crawler.timeout_ms",
    value: 60000,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Thời gian chờ tối đa cho mỗi yêu cầu HTTP thu thập trang (FIRECRAWL_REQUEST_TIMEOUT_MS)",
  },
  {
    key: "crawler.worker_concurrency",
    value: 3,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Số lượng luồng worker chạy đồng thời xử lý hàng đợi cào dữ liệu (WORKER_CONCURRENCY)",
  },
  {
    key: "crawler.job_timeout_ms",
    value: 300000,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Thời gian chạy tối đa cho toàn bộ một tiến trình cào trước khi timeout (WORKER_JOB_TIMEOUT_MS)",
  },
  {
    key: "crawler.max_stalled_count",
    value: 1,
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Số lần tối đa cho phép worker khôi phục tác vụ cào khi bị treo (WORKER_MAX_STALLED_COUNT)",
  },
  {
    key: "storage.default_driver",
    value: "s3",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Driver lưu trữ tệp xuất dữ liệu mặc định: 's3' hoặc 'local' (STORAGE_DRIVER)",
  },
  {
    key: "storage.export_dir",
    value: "storage/exports",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Thư mục lưu trữ tạm thời các gói nén ZIP trên máy chủ (STORAGE_EXPORT_DIR)",
  },
  {
    key: "storage.s3.bucket",
    value: "data-crawler-exports",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Tên bucket lưu trữ các tệp xuất dữ liệu cào dạng nén ZIP (S3_BUCKET)",
  },
  {
    key: "storage.s3.region",
    value: "us-east-1",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Vùng máy chủ lưu trữ dữ liệu tệp nén S3 (S3_REGION)",
  },
  {
    key: "storage.s3.endpoint",
    value: "http://127.0.0.1:9000",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: false,
    description: "Địa chỉ Endpoint kết nối dịch vụ lưu trữ AWS S3 hoặc MinIO (S3_ENDPOINT)",
  },

  // ==========================================
  // 2. FEATURE_FLAG (Cờ bật/tắt tính năng động)
  // ==========================================
  {
    key: "feature.registration.enabled",
    value: true,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Cho phép người dùng mới đăng ký tài khoản tự do trên hệ thống",
  },
  {
    key: "feature.ai.enabled",
    value: false,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Kích hoạt các công cụ phân tích, trích xuất cấu trúc và làm sạch bằng AI",
  },
  {
    key: "feature.maintenance_mode.enabled",
    value: false,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Kích hoạt chế độ bảo trì hệ thống toàn diện, tạm ngừng nhận tác vụ mới",
  },
  {
    key: "feature.change_detection.enabled",
    value: true,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Tự động so sánh và tạo báo cáo Diff biến động nội dung khi cào định kỳ",
  },
  {
    key: "feature.export.zip.enabled",
    value: true,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Cho phép đóng gói và xuất toàn bộ dữ liệu cào sang tệp nén ZIP",
  },
  {
    key: "feature.webhook.deliveries.enabled",
    value: true,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Kích hoạt cơ chế phát webhook tự động đến các endpoint đã đăng ký",
  },
  {
    key: "feature.dark_mode_default.enabled",
    value: true,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Gợi ý bật giao diện tối (Dark Mode) mặc định cho người dùng mới",
  },
  {
    key: "feature.social_login.enabled",
    value: false,
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
    description: "Cờ tính năng: Cho phép đăng nhập nhanh qua Google hoặc GitHub OAuth",
  },

  // ==========================================
  // 3. INTEGRATION (Tích hợp dịch vụ, Firecrawl & Webhook)
  // ==========================================
  {
    key: "integration.discord.invite_url",
    value: "https://discord.gg/datacrawler",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: true,
    description: "Đường dẫn lời mời tham gia cộng đồng hỗ trợ trên Discord",
  },
  {
    key: "integration.telegram.bot_username",
    value: "DataCrawlerBot",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: true,
    description: "Tên người dùng Bot Telegram chính thức để nhận thông báo và điều khiển",
  },
  {
    key: "integration.firecrawl.api_key",
    value: "fc-ae80a8acc69a4f42a8bca0e80370077e",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: false,
    description: "Khóa Firecrawl API Key điều khiển engine cào DOM (xoay tua & đổi động mà không cần restart)",
  },
  {
    key: "integration.firecrawl.base_url",
    value: "https://api.firecrawl.dev",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: false,
    description: "Địa chỉ API gốc của dịch vụ Firecrawl thu thập DOM (FIRECRAWL_BASE_URL)",
  },
  {
    key: "integration.smtp.from_name",
    value: "Data Crawler Support",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: true,
    description: "Tên người gửi hiển thị trong các email hệ thống (SMTP_FROM)",
  },
  {
    key: "integration.smtp.from_email",
    value: "no-reply@datacrawler.com",
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: true,
    description: "Địa chỉ email gửi thông báo hệ thống và mã kích hoạt (SMTP_FROM)",
  },
  {
    key: "integration.webhook.retry_limit",
    value: 3,
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: false,
    description: "Số lần tự động thử lại tối đa khi gửi webhook thông báo thất bại",
  },
  {
    key: "integration.webhook.timeout_ms",
    value: 10000,
    category: SYSTEM_CONFIG_CATEGORY.INTEGRATION,
    isPublic: false,
    description: "Thời gian chờ tối đa cho mỗi yêu cầu gửi webhook (ms)",
  },

  // ==========================================
  // 4. SECURITY (Bảo mật, Token, Quotas & Rate Limits)
  // ==========================================
  {
    key: "jwt.access_expires_in",
    value: "1d",
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Thời gian hết hạn của JWT Access Token cho phiên đăng nhập (JWT_ACCESS_EXPIRES_IN)",
  },
  {
    key: "jwt.refresh_expires_in",
    value: "7d",
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Thời gian hết hạn của Refresh Token cho phiên đăng nhập (JWT_REFRESH_EXPIRES_IN)",
  },
  {
    key: "quota.user_max_pages",
    value: 100,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Hạn ngạch số trang cào tối đa mặc định cho tài khoản người dùng thông thường (USER_MAX_PAGES)",
  },
  {
    key: "quota.user_max_jobs_per_day",
    value: 10,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Hạn ngạch số tác vụ cào tối đa trong một ngày cho mỗi tài khoản (USER_MAX_JOBS_PER_DAY)",
  },
  {
    key: "quota.user_max_concurrent_jobs",
    value: 3,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Hạn ngạch số tác vụ cào được phép chạy song song cho mỗi tài khoản (USER_MAX_CONCURRENT_JOBS)",
  },
  {
    key: "quota.user_max_pages_per_month",
    value: 1000,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Hạn ngạch số trang cào tối đa trong một tháng cho mỗi tài khoản (USER_MAX_PAGES_PER_MONTH)",
  },
  {
    key: "quota.user_max_jobs_per_month",
    value: 100,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Hạn ngạch số tác vụ cào tối đa trong một tháng cho mỗi tài khoản (USER_MAX_JOBS_PER_MONTH)",
  },
  {
    key: "rate_limit.window_ms",
    value: 900000,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Chu kỳ tính giới hạn yêu cầu API (ms, tương đương 15 phút) (RATE_LIMIT_WINDOW_MS)",
  },
  {
    key: "rate_limit.max_requests",
    value: 1000,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Số lượng yêu cầu API tối đa được phép trong một chu kỳ giới hạn (RATE_LIMIT_MAX)",
  },
  {
    key: "rate_limit.max_requests_per_minute",
    value: 60,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Số lượng request tối đa cho phép mỗi phút cho mỗi địa chỉ IP",
  },
  {
    key: "security.password_min_length",
    value: 8,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: true,
    description: "Độ dài tối thiểu của mật khẩu khi đăng ký hoặc đổi mật khẩu",
  },
  {
    key: "security.session_timeout_minutes",
    value: 1440,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Thời hạn hết hạn của phiên làm việc Access Token (phút, tương đương 24 giờ)",
  },
  {
    key: "security.max_login_attempts",
    value: 5,
    category: SYSTEM_CONFIG_CATEGORY.SECURITY,
    isPublic: false,
    description: "Số lần đăng nhập sai tối đa trước khi tài khoản bị tạm khóa",
  },
] as const;
