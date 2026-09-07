-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" UUID;

-- CreateIndex
CREATE INDEX "crawl_jobs_deleted_at_idx" ON "crawl_jobs"("deleted_at");

-- CreateIndex
CREATE INDEX "crawl_jobs_user_id_deleted_at_idx" ON "crawl_jobs"("user_id", "deleted_at");
