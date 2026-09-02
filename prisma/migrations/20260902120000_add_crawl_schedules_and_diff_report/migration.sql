-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN "schedule_id" UUID,
ADD COLUMN "diff_report_path" TEXT,
ADD COLUMN "diff_summary" JSONB;

-- CreateTable
CREATE TABLE "crawl_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_url" TEXT NOT NULL,
    "domain" TEXT,
    "mode" "CrawlMode" NOT NULL DEFAULT 'SCRAPE',
    "frequency" "ScheduleFrequency" NOT NULL DEFAULT 'DAILY',
    "cron_expression" TEXT,
    "hour" INTEGER NOT NULL DEFAULT 0,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "max_pages" INTEGER NOT NULL DEFAULT 20,
    "max_depth" INTEGER NOT NULL DEFAULT 1,
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_diff" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_schedules_user_id_idx" ON "crawl_schedules"("user_id");

-- CreateIndex
CREATE INDEX "crawl_schedules_is_active_next_run_at_idx" ON "crawl_schedules"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "crawl_jobs_schedule_id_idx" ON "crawl_jobs"("schedule_id");

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "crawl_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_schedules" ADD CONSTRAINT "crawl_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
