-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "normalized_url" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "word_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "data_quality_score" INTEGER,
ADD COLUMN     "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[];
