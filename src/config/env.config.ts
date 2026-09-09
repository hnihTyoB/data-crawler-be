export const envConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "9898", 10),
  trustProxy: process.env.TRUST_PROXY || "false",
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "datacrawler",
    ssl: process.env.DB_SSL === "true",
  },
  get databaseUrl() {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }
    const isSupabase =
      this.database.host.includes("supabase.co") ||
      this.database.host.includes("pooler.supabase.com");
    const sslParam = (this.database.ssl || isSupabase) ? "&sslmode=require" : "";
    return `postgresql://${encodeURIComponent(this.database.user)}:${encodeURIComponent(this.database.password)}@${this.database.host}:${this.database.port}/${this.database.name}?schema=public${sslParam}`;
  },
  jwt: {
    accessSecret: (() => {
      const s = process.env.JWT_ACCESS_SECRET;
      if (!s || s.length < 32)
        throw new Error(
          "[Startup] JWT_ACCESS_SECRET must be set and at least 32 characters long",
        );
      return s;
    })(),
    refreshSecret: (() => {
      const s = process.env.JWT_REFRESH_SECRET;
      if (!s || s.length < 32)
        throw new Error(
          "[Startup] JWT_REFRESH_SECRET must be set and at least 32 characters long",
        );
      return s;
    })(),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    emailVerificationSecret:
      process.env.JWT_EMAIL_VERIFICATION_SECRET ||
      `${process.env.JWT_ACCESS_SECRET}-email-verify`,
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || "",
    baseUrl: process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev",
    requestTimeoutMs: parseInt(
      process.env.FIRECRAWL_REQUEST_TIMEOUT_MS || "30000",
      10,
    ),
  },
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    enabled: process.env.REDIS_ENABLED === "true",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "1000", 10),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3",
    exportDir: process.env.STORAGE_EXPORT_DIR || "storage/exports",
    s3: {
      endpoint: process.env.S3_ENDPOINT || "",
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET || "data-crawler-exports",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    },
  },
  crawl: {
    maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "100", 10),
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || "3", 10),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3", 10),
    jobTimeoutMs: parseInt(process.env.WORKER_JOB_TIMEOUT_MS || "300000", 10),
    maxStalledCount: parseInt(process.env.WORKER_MAX_STALLED_COUNT || "1", 10),
  },
  quota: {
    defaultMaxPages: parseInt(process.env.USER_MAX_PAGES || "100", 10),
    defaultMaxJobsPerDay: parseInt(
      process.env.USER_MAX_JOBS_PER_DAY || "10",
      10,
    ),
    defaultMaxConcurrentJobs: parseInt(
      process.env.USER_MAX_CONCURRENT_JOBS || "3",
      10,
    ),
    defaultMaxPagesPerMonth: parseInt(
      process.env.USER_MAX_PAGES_PER_MONTH || "1000",
      10,
    ),
    defaultMaxJobsPerMonth: parseInt(
      process.env.USER_MAX_JOBS_PER_MONTH || "100",
      10,
    ),
  },
  cors: {
    allowedOrigins: (
      process.env.CORS_ALLOWED_ORIGINS ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  mail: {
    host: process.env.SMTP_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT || "2525", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Data Crawler <no-reply@datacrawler.com>",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
  webhook: {
    encryptionKey: (() => {
      const k = process.env.WEBHOOK_ENCRYPTION_KEY;
      if (!k || !/^[0-9a-fA-F]{64}$/.test(k)) {
        throw new Error(
          "[Startup] WEBHOOK_ENCRYPTION_KEY must be set as a 64-character hex string",
        );
      }
      return k;
    })(),
    queueName: process.env.WEBHOOK_QUEUE_NAME || "webhook-delivery",
  },
};
