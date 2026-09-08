import swaggerAutogen from "swagger-autogen";
import fs from "fs";
import path from "path";
import { swaggerPaths } from "./swagger-paths";

const doc = {
  openapi: "3.0.0",
  info: {
    title: "Data Crawler API Docs",
    version: "1.0.0",
    description:
      "API Backend cho dịch vụ Crawl website bất đồng bộ sử dụng Express, Prisma và BullMQ (Tự động sinh tài liệu).",
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1 Base URL",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập token JWT của bạn theo định dạng: Bearer <token>",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Nhập API Key dạng dc_xxx để xác thực request",
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
    {
      ApiKeyAuth: [],
    },
  ],
};

// Định nghĩa schema chuẩn OpenAPI 3.0.0 để ghi đè sau khi generate
const rawSchemas = {
  User: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string", format: "email" },
      fullName: { type: "string" },
      role: { type: "string", enum: ["ADMIN", "CRAWLER_USER", "VIEWER"] },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CrawlJob: {
    type: "object",
    properties: {
      id: { type: "string" },
      startUrl: { type: "string" },
      domain: { type: "string" },
      mode: {
        type: "string",
        enum: ["SCRAPE", "CRAWL", "SITEMAP", "URL_LIST"],
      },
      status: {
        type: "string",
        enum: [
          "PENDING",
          "QUEUED",
          "RUNNING",
          "PROCESSING_EXPORT",
          "COMPLETED",
          "FAILED",
          "CANCELED",
        ],
      },
      maxPages: { type: "integer" },
      maxDepth: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CrawlPage: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      jobId: { type: "string", format: "uuid" },
      url: { type: "string", format: "uri" },
      normalizedUrl: { type: "string", format: "uri" },
      title: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: [
          "PENDING",
          "SUCCESS",
          "FAILED",
          "BLOCKED",
          "REQUIRES_LOGIN",
          "CAPTCHA_DETECTED",
          "PAYWALL_DETECTED",
          "TIMEOUT",
          "SKIPPED",
        ],
      },
      statusCode: { type: "integer", nullable: true },
      errorMessage: { type: "string", nullable: true },
      hasSensitiveData: { type: "boolean" },
      wordCount: { type: "integer" },
      contentHash: { type: "string", nullable: true },
      dataQualityScore: { type: "integer", nullable: true },
      warnings: { type: "array", items: { type: "string" } },
      crawledAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CrawlPageExportDetail: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      jobId: { type: "string", format: "uuid" },
      url: { type: "string", format: "uri" },
      normalizedUrl: { type: "string", format: "uri" },
      title: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: [
          "PENDING",
          "SUCCESS",
          "FAILED",
          "BLOCKED",
          "REQUIRES_LOGIN",
          "CAPTCHA_DETECTED",
          "PAYWALL_DETECTED",
          "TIMEOUT",
          "SKIPPED",
        ],
      },
      statusCode: { type: "integer", nullable: true },
      errorMessage: { type: "string", nullable: true },
      hasSensitiveData: { type: "boolean" },
      rawMarkdown: {
        type: "string",
        nullable: true,
        description: "Nội dung Markdown thô nguyên bản từ crawler",
      },
      cleanText: {
        type: "string",
        nullable: true,
        description:
          "Nội dung plain text thuần túy đã xóa toàn bộ ký tự Markdown",
      },
      mainContent: {
        type: "string",
        nullable: true,
        description:
          "Nội dung chính đã lọc bỏ nav/footer/sidebar, khuyến nghị cho AI Agent / LLM Ingest",
      },
      wordCount: { type: "integer" },
      contentHash: { type: "string", nullable: true },
      dataQualityScore: { type: "integer", nullable: true },
      warnings: { type: "array", items: { type: "string" } },
      links: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            sourceUrl: { type: "string" },
            type: { type: "string", enum: ["internal", "external"] },
          },
        },
      },
      images: {
        type: "array",
        items: {
          type: "object",
          properties: {
            altText: { type: "string", nullable: true },
            sourceUrl: { type: "string" },
            orderIndex: { type: "integer" },
            type: { type: "string" },
          },
        },
      },
      tables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tableIndex: { type: "integer" },
            headers: { type: "array", items: { type: "string" } },
            rowsCount: { type: "integer" },
            colsCount: { type: "integer" },
            sheetName: { type: "string" },
          },
        },
      },
      crawledAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  PagesExport: {
    type: "object",
    properties: {
      schemaVersion: { type: "string", example: "1.0.0" },
      pages: {
        type: "array",
        items: { $ref: "#/components/schemas/CrawlPageExportDetail" },
      },
    },
  },
  CrawlExport: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      jobId: { type: "string" },
      exportType: {
        type: "string",
        enum: ["JSON", "CSV", "XLSX", "MARKDOWN", "ZIP"],
      },
      status: { type: "string", enum: ["PENDING", "COMPLETED", "FAILED"] },
      fileName: { type: "string" },
      fileSize: { type: "integer" },
      mimeType: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", example: "admin@example.com" },
      password: { type: "string", example: "Admin@123" },
    },
  },
  RegisterRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", example: "user@example.com" },
      password: { type: "string", example: "Password123!" },
      fullName: { type: "string", example: "Nguyen Van A" },
    },
  },
  ResendVerificationRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email", example: "user@example.com" },
    },
  },
  RequestDeactivationRequest: {
    type: "object",
    required: ["password"],
    properties: {
      password: {
        type: "string",
        example: "Password123!",
        description: "Mật khẩu hiện tại của người dùng để xác nhận danh tính",
      },
    },
  },
  ConfirmDeactivationRequest: {
    type: "object",
    required: ["token"],
    properties: {
      token: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        description: "Mã xác nhận vô hiệu hóa được gửi qua email",
      },
    },
  },
  RefreshRequest: {
    type: "object",
    required: ["refreshToken"],
    properties: {
      refreshToken: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  },
  LogoutRequest: {
    type: "object",
    required: ["refreshToken"],
    properties: {
      refreshToken: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      },
    },
  },
  UpdateMeRequest: {
    type: "object",
    properties: {
      fullName: { type: "string", example: "Nguyen Van B" },
    },
  },
  ChangePasswordRequest: {
    type: "object",
    required: ["currentPassword", "newPassword", "confirmPassword"],
    properties: {
      currentPassword: { type: "string", example: "OldPassword123!" },
      newPassword: { type: "string", example: "NewPassword123!" },
      confirmPassword: { type: "string", example: "NewPassword123!" },
    },
  },
  CreateUserRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "crawler_user@example.com",
      },
      password: { type: "string", example: "Password123!" },
      fullName: { type: "string", example: "Crawler User" },
      role: {
        type: "string",
        enum: ["ADMIN", "CRAWLER_USER", "VIEWER"],
        example: "CRAWLER_USER",
      },
      maxPagesLimit: { type: "integer", example: 100 },
      maxJobsPerDayLimit: { type: "integer", example: 10 },
      maxConcurrentJobsLimit: { type: "integer", example: 3 },
    },
  },
  UpdateUserRequest: {
    type: "object",
    properties: {
      fullName: { type: "string", example: "Updated Name" },
      role: {
        type: "string",
        enum: ["ADMIN", "CRAWLER_USER", "VIEWER"],
        example: "VIEWER",
      },
      isActive: { type: "boolean", example: true },
      maxPagesLimit: { type: "integer", example: 200 },
      maxJobsPerDayLimit: { type: "integer", example: 20 },
      maxConcurrentJobsLimit: { type: "integer", example: 5 },
    },
  },
  CreateCrawlJobRequest: {
    type: "object",
    properties: {
      startUrl: {
        type: "string",
        format: "uri",
        example: "https://example.com",
      },
      mode: {
        type: "string",
        enum: ["SCRAPE", "CRAWL", "SITEMAP", "URL_LIST"],
        example: "CRAWL",
      },
      maxPages: { type: "integer", minimum: 1, maximum: 1000, example: 100 },
      maxDepth: { type: "integer", minimum: 1, maximum: 10, example: 3 },
      urls: {
        type: "array",
        items: { type: "string", format: "uri" },
        example: ["https://example.com/1", "https://example.com/2"],
        description: "Bắt buộc khi mode là URL_LIST",
      },
    },
  },
  CreateExportRequest: {
    type: "object",
    required: ["exportType"],
    properties: {
      exportType: {
        type: "string",
        enum: ["JSON", "CSV", "XLSX", "MARKDOWN", "ZIP"],
        example: "JSON",
      },
    },
  },
  CreateApiKeyRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        example: "Production Key",
      },
      expiresAt: {
        type: "string",
        format: "date-time",
        nullable: true,
        description:
          "Thời điểm hết hạn trong tương lai; null nếu key không hết hạn",
        example: "2026-12-31T23:59:59.000Z",
      },
    },
  },
  UpdateApiKeyStatusRequest: {
    type: "object",
    required: ["isActive"],
    additionalProperties: false,
    properties: {
      isActive: { type: "boolean", example: false },
    },
  },
  ApiKey: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
      keyPrefix: { type: "string" },
      isActive: { type: "boolean" },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ApiKeyWithRaw: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
      keyPrefix: { type: "string" },
      isActive: { type: "boolean" },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      rawKey: {
        type: "string",
        readOnly: true,
        description: "Khóa bí mật chỉ được trả về một lần khi tạo",
        example: "dc_3d98031d279cf4...",
      },
    },
  },
  CreateWebhookConfigRequest: {
    type: "object",
    required: ["url", "secret", "events"],
    properties: {
      url: {
        type: "string",
        format: "uri",
        example: "https://example.com/webhook",
      },
      secret: { type: "string", example: "my_webhook_secret_key_123456" },
      events: {
        type: "array",
        items: { type: "string", enum: ["job.completed", "job.failed"] },
        example: ["job.completed", "job.failed"],
      },
    },
  },
  WebhookConfig: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      url: { type: "string", format: "uri" },
      isActive: { type: "boolean" },
      events: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  WebhookDelivery: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      webhookConfigId: { type: "string", format: "uuid" },
      crawlJobId: { type: "string", format: "uuid" },
      event: { type: "string" },
      payload: { type: "object" },
      status: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] },
      statusCode: { type: "integer", nullable: true },
      attempt: { type: "integer" },
      responseBody: { type: "string", nullable: true },
      errorMessage: { type: "string", nullable: true },
      deliveredAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      webhookConfig: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
      },
    },
  },
  CrawlSchedule: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
      startUrl: { type: "string", format: "uri" },
      domain: { type: "string", nullable: true },
      mode: {
        type: "string",
        enum: ["SCRAPE", "CRAWL", "SITEMAP", "URL_LIST"],
      },
      frequency: {
        type: "string",
        enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
      },
      cronExpression: { type: "string", nullable: true },
      hour: { type: "integer" },
      minute: { type: "integer" },
      dayOfWeek: { type: "integer", nullable: true },
      dayOfMonth: { type: "integer", nullable: true },
      timezone: { type: "string" },
      maxPages: { type: "integer" },
      maxDepth: { type: "integer" },
      urls: { type: "array", items: { type: "string" } },
      isActive: { type: "boolean" },
      autoDiff: { type: "boolean" },
      lastRunAt: { type: "string", format: "date-time", nullable: true },
      nextRunAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CreateCrawlScheduleRequest: {
    type: "object",
    required: ["name", "startUrl"],
    properties: {
      name: { type: "string", example: "Crawl tin tức hàng ngày" },
      startUrl: {
        type: "string",
        format: "uri",
        example: "https://example.com/news",
      },
      mode: {
        type: "string",
        enum: ["SCRAPE", "CRAWL", "SITEMAP", "URL_LIST"],
        example: "CRAWL",
      },
      frequency: {
        type: "string",
        enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
        example: "DAILY",
      },
      cronExpression: { type: "string", example: "0 0 * * *" },
      hour: { type: "integer", example: 2 },
      minute: { type: "integer", example: 0 },
      dayOfWeek: { type: "integer", example: 1 },
      dayOfMonth: { type: "integer", example: 1 },
      timezone: { type: "string", example: "UTC" },
      maxPages: { type: "integer", example: 50 },
      maxDepth: { type: "integer", example: 2 },
      urls: { type: "array", items: { type: "string" } },
      isActive: { type: "boolean", example: true },
      autoDiff: { type: "boolean", example: true },
    },
  },
  UpdateCrawlScheduleRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      startUrl: { type: "string", format: "uri" },
      mode: {
        type: "string",
        enum: ["SCRAPE", "CRAWL", "SITEMAP", "URL_LIST"],
      },
      frequency: {
        type: "string",
        enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
      },
      cronExpression: { type: "string" },
      hour: { type: "integer" },
      minute: { type: "integer" },
      dayOfWeek: { type: "integer" },
      dayOfMonth: { type: "integer" },
      timezone: { type: "string" },
      maxPages: { type: "integer" },
      maxDepth: { type: "integer" },
      urls: { type: "array", items: { type: "string" } },
      isActive: { type: "boolean" },
      autoDiff: { type: "boolean" },
    },
  },
  DiffReport: {
    type: "object",
    properties: {
      schemaVersion: { type: "string", example: "1.0.0" },
      generatedAt: { type: "string", format: "date-time" },
      jobId: { type: "string", format: "uuid" },
      previousJobId: { type: "string", format: "uuid", nullable: true },
      scheduleId: { type: "string", format: "uuid", nullable: true },
      startUrl: { type: "string" },
      domain: { type: "string", nullable: true },
      summary: {
        type: "object",
        properties: {
          totalCurrentPages: { type: "integer" },
          totalPreviousPages: { type: "integer" },
          newPagesCount: { type: "integer" },
          modifiedPagesCount: { type: "integer" },
          deletedPagesCount: { type: "integer" },
          unchangedPagesCount: { type: "integer" },
          changeRate: { type: "number" },
        },
      },
      changes: {
        type: "object",
        properties: {
          new: { type: "array", items: { type: "object" } },
          modified: { type: "array", items: { type: "object" } },
          deleted: { type: "array", items: { type: "object" } },
          unchanged: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  Role: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      slug: { type: "string" },
      description: { type: "string", nullable: true },
      isSystem: { type: "boolean" },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  Permission: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      slug: { type: "string" },
      description: { type: "string", nullable: true },
      resource: { type: "string" },
      action: { type: "string" },
      isSystem: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CreateRoleRequest: {
    type: "object",
    required: ["name", "slug"],
    properties: {
      name: { type: "string", example: "Finance Auditor" },
      slug: { type: "string", example: "finance_auditor" },
      description: {
        type: "string",
        example: "Audits financial records and reports",
      },
      permissionIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
      },
    },
  },
  UpdateRoleRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      isActive: { type: "boolean" },
    },
  },
  AssignRolePermissionsRequest: {
    type: "object",
    required: ["permissionIds"],
    properties: {
      permissionIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
      },
    },
  },
  AssignUserRolesRequest: {
    type: "object",
    required: ["roleIds"],
    properties: {
      roleIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
      },
    },
  },
  UpdateWebhookConfigRequest: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        example: "https://example.com/webhook",
      },
      secret: {
        type: "string",
        minLength: 16,
        maxLength: 128,
        example: "new_webhook_secret_key_123456",
      },
      events: {
        type: "array",
        items: { type: "string", enum: ["job.completed", "job.failed"] },
        example: ["job.completed"],
      },
      isActive: { type: "boolean", example: true },
    },
  },
  ExtractionTemplateField: {
    type: "object",
    required: ["name", "selector", "attr", "required"],
    properties: {
      name: { type: "string", example: "title" },
      selector: { type: "string", example: "h1.product-title" },
      attr: { type: "string", example: "innerText" },
      required: { type: "boolean", example: true },
    },
  },
  ExtractionTemplate: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      name: { type: "string", example: "E-Commerce Product Extractor" },
      domain: { type: "string", example: "example.com" },
      fields: {
        type: "array",
        items: { $ref: "#/components/schemas/ExtractionTemplateField" },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CreateExtractionTemplateRequest: {
    type: "object",
    required: ["name", "domain", "fields"],
    properties: {
      name: { type: "string", example: "E-Commerce Product Extractor" },
      domain: { type: "string", example: "example.com" },
      fields: {
        type: "array",
        items: { $ref: "#/components/schemas/ExtractionTemplateField" },
      },
    },
  },
  UpdateExtractionTemplateRequest: {
    type: "object",
    properties: {
      name: { type: "string", example: "Updated Template Name" },
      fields: {
        type: "array",
        items: { $ref: "#/components/schemas/ExtractionTemplateField" },
      },
    },
  },
  CrawlJobLog: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      jobId: { type: "string", format: "uuid" },
      level: { type: "string", enum: ["INFO", "WARN", "ERROR"] },
      step: { type: "string", example: "FETCH_PAGE" },
      message: { type: "string", example: "Successfully fetched page 1" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  DashboardStats: {
    type: "object",
    properties: {
      jobs: {
        type: "object",
        properties: {
          total: { type: "integer", example: 42 },
          completed: { type: "integer", example: 35 },
          failed: { type: "integer", example: 3 },
          running: { type: "integer", example: 2 },
          pending: { type: "integer", example: 2 },
        },
      },
      pages: {
        type: "object",
        properties: {
          total: { type: "integer", example: 1250 },
          successful: { type: "integer", example: 1200 },
          failed: { type: "integer", example: 50 },
        },
      },
      schedules: {
        type: "object",
        properties: {
          total: { type: "integer", example: 5 },
          active: { type: "integer", example: 4 },
        },
      },
      exports: {
        type: "object",
        properties: {
          total: { type: "integer", example: 18 },
        },
      },
    },
  },
  SystemConfig: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      key: { type: "string", example: "feature.ai.enabled" },
      value: { example: true },
      description: { type: "string", nullable: true, example: "Kích hoạt AI" },
      category: {
        type: "string",
        enum: ["GENERAL", "FEATURE_FLAG", "INTEGRATION", "SECURITY"],
        example: "FEATURE_FLAG",
      },
      isPublic: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CreateSystemConfigRequest: {
    type: "object",
    required: ["key", "value"],
    properties: {
      key: { type: "string", example: "feature.new_module.enabled" },
      value: { example: true },
      description: { type: "string", example: "Bật tắt tính năng mới" },
      category: {
        type: "string",
        enum: ["GENERAL", "FEATURE_FLAG", "INTEGRATION", "SECURITY"],
        example: "FEATURE_FLAG",
      },
      isPublic: { type: "boolean", example: false },
    },
  },
  UpdateSystemConfigRequest: {
    type: "object",
    properties: {
      value: { example: false },
      description: { type: "string", example: "Mô tả mới" },
      category: {
        type: "string",
        enum: ["GENERAL", "FEATURE_FLAG", "INTEGRATION", "SECURITY"],
      },
      isPublic: { type: "boolean" },
    },
  },
};

const outputFile = "./src/docs/swagger.json";
const endpointsFiles = ["./src/routes/index.ts"];

async function generate() {
  try {
    // Chạy generator
    await swaggerAutogen({ openapi: "3.0.0" })(outputFile, endpointsFiles, doc);

    // Sau khi generate thành công, đọc file và chèn các cấu hình tĩnh vào
    const filePath = path.resolve(outputFile);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const swaggerJson = JSON.parse(fileContent);

      // Merge các schema chuẩn vào
      if (!swaggerJson.components) {
        swaggerJson.components = {};
      }
      swaggerJson.components.schemas = rawSchemas;

      // Merge các swaggerPaths tập trung vào swaggerJson.paths
      if (swaggerJson.paths) {
        const jsonPathKeys = Object.keys(swaggerJson.paths);
        const findMatchingKey = (standardPath: string) => {
          const normalize = (p: string) => p.replace(/\/$/, "") || "/";
          const normalizedStd = normalize(standardPath);
          return jsonPathKeys.find((k) => normalize(k) === normalizedStd);
        };

        for (const staticPathKey in swaggerPaths) {
          const matchingJsonKey =
            findMatchingKey(staticPathKey) || staticPathKey;

          if (!swaggerJson.paths[matchingJsonKey]) {
            swaggerJson.paths[matchingJsonKey] = {};
          }

          for (const methodKey in swaggerPaths[staticPathKey]) {
            const autogenEndpoint =
              swaggerJson.paths[matchingJsonKey][methodKey] || {};
            const staticEndpoint = swaggerPaths[staticPathKey][methodKey];

            swaggerJson.paths[matchingJsonKey][methodKey] = {
              ...autogenEndpoint,
              ...staticEndpoint,
            };
          }
        }

        // Chuẩn hóa lại toàn bộ key trong swaggerJson.paths để loại bỏ trailing slash (ví dụ /users/ -> /users)
        const cleanedPaths: Record<string, any> = {};
        for (const pathKey in swaggerJson.paths) {
          const cleanKey =
            pathKey.length > 1 && pathKey.endsWith("/")
              ? pathKey.slice(0, -1)
              : pathKey;
          cleanedPaths[cleanKey] = swaggerJson.paths[pathKey];
        }
        swaggerJson.paths = cleanedPaths;
      }

      // Lọc bỏ tham số header authorization trùng lặp do tự động nhận diện
      if (swaggerJson.paths) {
        for (const path in swaggerJson.paths) {
          for (const method in swaggerJson.paths[path]) {
            const endpoint = swaggerJson.paths[path][method];
            if (endpoint.parameters) {
              endpoint.parameters = endpoint.parameters.filter(
                (param: { name?: string }) =>
                  param.name?.toLowerCase() !== "authorization",
              );
              // Nếu mảng parameters rỗng thì xóa luôn thuộc tính parameters
              if (endpoint.parameters.length === 0) {
                delete endpoint.parameters;
              }
            }
          }
        }
      }

      // Ghi đè lại file
      fs.writeFileSync(filePath, JSON.stringify(swaggerJson, null, 2), "utf8");
      console.log(
        "Swagger-autogen: Schemas and custom paths successfully patched with OpenAPI 3.0.",
      );
    }
  } catch (error) {
    console.error("Error generating swagger docs:", error);
  }
}

generate();
