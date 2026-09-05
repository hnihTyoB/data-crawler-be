/*
  Warnings:

  - You are about to drop the `CrawlJobLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CrawlJobLog" DROP CONSTRAINT "CrawlJobLog_job_id_fkey";

-- DropForeignKey
ALTER TABLE "crawl_assets" DROP CONSTRAINT "crawl_assets_crawl_job_id_fkey";

-- DropTable
DROP TABLE "CrawlJobLog";

-- CreateTable
CREATE TABLE "crawl_job_logs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_job_logs_job_id_created_at_idx" ON "crawl_job_logs"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_ip_address_idx" ON "audit_logs"("ip_address");

-- CreateIndex
CREATE INDEX "crawl_assets_crawl_job_id_idx" ON "crawl_assets"("crawl_job_id");

-- CreateIndex
CREATE INDEX "crawl_jobs_user_id_created_at_idx" ON "crawl_jobs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "crawl_assets" ADD CONSTRAINT "crawl_assets_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_job_logs" ADD CONSTRAINT "crawl_job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
