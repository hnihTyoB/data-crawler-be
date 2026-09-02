export const envConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  trustProxy: process.env.TRUST_PROXY || 'false',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'datacrawler',
    ssl: process.env.DB_SSL === 'true',
  },
  get databaseUrl() {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }
    const isSupabase = this.database.host.includes('supabase.co') || this.database.host.includes('pooler.supabase.com');
    const sslParam = this.database.ssl || isSupabase ? '&sslmode=require' : '';
    return `postgresql://${encodeURIComponent(this.database.user)}:${encodeURIComponent(this.database.password)}@${this.database.host}:${this.database.port}/${this.database.name}?schema=public${sslParam}`;
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || '',
    baseUrl: process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev',
    requestTimeoutMs: parseInt(process.env.FIRECRAWL_REQUEST_TIMEOUT_MS || '30000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    enabled: process.env.REDIS_ENABLED === 'true',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
    exportDir: process.env.STORAGE_EXPORT_DIR || 'storage/exports',
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || 'data-crawler-exports',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
  },
  crawl: {
    maxPages: parseInt(process.env.MAX_CRAWL_PAGES || '100', 10),
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || '3', 10),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
    jobTimeoutMs: parseInt(process.env.WORKER_JOB_TIMEOUT_MS || '300000', 10),
    maxStalledCount: parseInt(process.env.WORKER_MAX_STALLED_COUNT || '1', 10),
  },
  quota: {
    defaultMaxPages: parseInt(process.env.USER_MAX_PAGES || '100', 10),
    defaultMaxJobsPerDay: parseInt(process.env.USER_MAX_JOBS_PER_DAY || '10', 10),
    defaultMaxConcurrentJobs: parseInt(process.env.USER_MAX_CONCURRENT_JOBS || '3', 10),
  },
  mail: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Data Crawler <no-reply@datacrawler.com>',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  webhook: {
    encryptionKey: process.env.WEBHOOK_ENCRYPTION_KEY || 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    queueName: process.env.WEBHOOK_QUEUE_NAME || 'webhook-delivery',
  },
};
