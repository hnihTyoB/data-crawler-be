-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "structured_data" JSONB;

-- CreateTable
CREATE TABLE "extraction_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_templates_domain_idx" ON "extraction_templates"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_templates_user_id_domain_key" ON "extraction_templates"("user_id", "domain");

-- AddForeignKey
ALTER TABLE "extraction_templates" ADD CONSTRAINT "extraction_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
