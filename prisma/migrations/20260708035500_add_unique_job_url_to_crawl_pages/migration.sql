-- CreateIndex
CREATE UNIQUE INDEX "crawl_pages_job_id_url_key" ON "crawl_pages"("job_id", "url");
