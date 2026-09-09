-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "max_concurrent_jobs_limit" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "max_jobs_per_day_limit" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "max_jobs_per_month_limit" INTEGER DEFAULT 100,
ADD COLUMN     "max_pages_limit" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "max_pages_per_month_limit" INTEGER DEFAULT 1000;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "max_jobs_per_month_limit" INTEGER DEFAULT 100,
ADD COLUMN     "max_pages_per_month_limit" INTEGER DEFAULT 1000,
ADD COLUMN     "quota_reset_at" TIMESTAMP(3);
