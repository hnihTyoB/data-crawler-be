import { JobStatus } from "../../common/constants/job-status.constant";
import { CrawlMode } from "../../common/constants/crawl-mode.constant";

export interface CreateCrawlJobDto {
  startUrl?: string;
  mode?: CrawlMode;
  maxPages?: number;
  maxDepth?: number;
  urls?: string[];
  scheduleId?: string;
}

export interface CrawlJobQueryDto {
  status?: JobStatus;
  mode?: CrawlMode;
  search?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: string | number;
  limit?: string | number;
}

export interface UpdateCrawlJobStatusDto {
  status: JobStatus;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
}
