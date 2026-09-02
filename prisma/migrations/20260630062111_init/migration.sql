-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CRAWLER_USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_COMPLETED', 'FAILED', 'CANCELED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CrawlMode" AS ENUM ('SCRAPE', 'CRAWL', 'SITEMAP', 'URL_LIST');

-- CreateEnum
CREATE TYPE "CrawlPageStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'BLOCKED', 'REQUIRES_LOGIN', 'CAPTCHA_DETECTED', 'PAYWALL_DETECTED', 'TIMEOUT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('JSON', 'CSV', 'XLSX', 'MARKDOWN', 'MARKDOWN_ZIP', 'FULL_ZIP');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'LINK', 'PDF', 'FILE', 'VIDEO', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CRAWLER_USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_url" TEXT NOT NULL,
    "domain" TEXT,
    "mode" "CrawlMode" NOT NULL DEFAULT 'SCRAPE',
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'PENDING',
    "max_pages" INTEGER NOT NULL DEFAULT 20,
    "max_depth" INTEGER NOT NULL DEFAULT 1,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "success_pages" INTEGER NOT NULL DEFAULT 0,
    "failed_pages" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_pages" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "markdown_content" TEXT,
    "html_content_path" TEXT,
    "status" "CrawlPageStatus" NOT NULL DEFAULT 'PENDING',
    "status_code" INTEGER,
    "error_message" TEXT,
    "crawled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_assets" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "page_id" UUID,
    "asset_type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "source_url" TEXT,
    "alt_text" TEXT,
    "mime_type" TEXT,
    "order_index" INTEGER,
    "css_selector" TEXT,
    "dom_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_exports" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "export_type" "ExportType" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "crawl_jobs_user_id_idx" ON "crawl_jobs"("user_id");

-- CreateIndex
CREATE INDEX "crawl_jobs_status_idx" ON "crawl_jobs"("status");

-- CreateIndex
CREATE INDEX "crawl_jobs_created_at_idx" ON "crawl_jobs"("created_at");

-- CreateIndex
CREATE INDEX "crawl_pages_job_id_idx" ON "crawl_pages"("job_id");

-- CreateIndex
CREATE INDEX "crawl_pages_status_idx" ON "crawl_pages"("status");

-- CreateIndex
CREATE INDEX "crawl_assets_job_id_idx" ON "crawl_assets"("job_id");

-- CreateIndex
CREATE INDEX "crawl_assets_page_id_idx" ON "crawl_assets"("page_id");

-- CreateIndex
CREATE INDEX "crawl_assets_asset_type_idx" ON "crawl_assets"("asset_type");

-- CreateIndex
CREATE INDEX "crawl_exports_job_id_idx" ON "crawl_exports"("job_id");

-- CreateIndex
CREATE INDEX "crawl_exports_export_type_idx" ON "crawl_exports"("export_type");

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_assets" ADD CONSTRAINT "crawl_assets_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_assets" ADD CONSTRAINT "crawl_assets_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "crawl_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_exports" ADD CONSTRAINT "crawl_exports_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
