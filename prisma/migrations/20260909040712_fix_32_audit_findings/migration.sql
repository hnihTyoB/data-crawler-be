-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "crawl_jobs_schedule_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "webhook_configs_user_id_idx";

-- AlterTable crawl_pages: normalized_url nullable without default
ALTER TABLE "crawl_pages" ALTER COLUMN "normalized_url" DROP NOT NULL;
ALTER TABLE "crawl_pages" ALTER COLUMN "normalized_url" DROP DEFAULT;

-- AlterTable webhook_deliveries: safely cast status column to WebhookDeliveryStatus enum without dropping
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "webhook_deliveries" 
  ALTER COLUMN "status" TYPE "WebhookDeliveryStatus" USING (
    CASE 
      WHEN "status" = 'SUCCESS' THEN 'SUCCESS'::"WebhookDeliveryStatus"
      WHEN "status" = 'FAILED' THEN 'FAILED'::"WebhookDeliveryStatus"
      ELSE 'PENDING'::"WebhookDeliveryStatus"
    END
  );
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Invalidate legacy unhashed refresh tokens (BUG-005) so users re-login once with hashed tokens
DELETE FROM "refresh_tokens";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawl_job_logs_job_id_level_idx" ON "crawl_job_logs"("job_id", "level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawl_jobs_schedule_id_deleted_at_idx" ON "crawl_jobs"("schedule_id", "deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawl_pages_job_id_content_hash_idx" ON "crawl_pages"("job_id", "content_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_configs_user_id_is_active_idx" ON "webhook_configs"("user_id", "is_active");
