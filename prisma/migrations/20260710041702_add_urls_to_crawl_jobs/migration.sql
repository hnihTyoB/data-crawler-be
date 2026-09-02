-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
