/*
  Warnings:

  - The values [PARTIAL_COMPLETED,BLOCKED] on the enum `CrawlJobStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [MARKDOWN_ZIP,FULL_ZIP] on the enum `ExportType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `job_id` on the `crawl_assets` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- AlterEnum
BEGIN;
CREATE TYPE "CrawlJobStatus_new" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'PROCESSING_EXPORT', 'COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED');
ALTER TABLE "crawl_jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "crawl_jobs" ALTER COLUMN "status" TYPE "CrawlJobStatus_new" USING ("status"::text::"CrawlJobStatus_new");
ALTER TYPE "CrawlJobStatus" RENAME TO "CrawlJobStatus_old";
ALTER TYPE "CrawlJobStatus_new" RENAME TO "CrawlJobStatus";
DROP TYPE "CrawlJobStatus_old";
ALTER TABLE "crawl_jobs" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ExportType_new" AS ENUM ('JSON', 'CSV', 'XLSX', 'MARKDOWN', 'ZIP');
ALTER TABLE "crawl_exports" ALTER COLUMN "export_type" TYPE "ExportType_new" USING ("export_type"::text::"ExportType_new");
ALTER TYPE "ExportType" RENAME TO "ExportType_old";
ALTER TYPE "ExportType_new" RENAME TO "ExportType";
DROP TYPE "ExportType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "crawl_assets" DROP CONSTRAINT "crawl_assets_job_id_fkey";

-- DropIndex
DROP INDEX "crawl_assets_job_id_idx";

-- DropIndex
DROP INDEX "crawl_jobs_user_id_idx";

-- AlterTable
ALTER TABLE "crawl_assets" DROP COLUMN "job_id",
ADD COLUMN     "crawl_job_id" UUID;

-- AlterTable
ALTER TABLE "crawl_exports" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "expired_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "delay_ms" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "respect_robots_txt" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "content" TEXT;

-- CreateTable
CREATE TABLE "CrawlJobLog" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_jobs_domain_idx" ON "crawl_jobs"("domain");

-- CreateIndex
CREATE INDEX "crawl_jobs_user_id_status_idx" ON "crawl_jobs"("user_id", "status");

-- AddForeignKey
ALTER TABLE "crawl_assets" ADD CONSTRAINT "crawl_assets_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "crawl_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlJobLog" ADD CONSTRAINT "CrawlJobLog_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
