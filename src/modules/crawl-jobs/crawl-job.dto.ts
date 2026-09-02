import { CrawlJobStatus, CrawlMode } from '@prisma/client';

export interface CreateCrawlJobDto {
  startUrl?: string;
  mode?: CrawlMode;
  maxPages?: number;
  maxDepth?: number;
  urls?: string[];
  scheduleId?: string;
}

export interface CrawlJobQueryDto {
  status?: CrawlJobStatus;
  mode?: CrawlMode;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: string | number;
  limit?: string | number;
}

export interface UpdateCrawlJobStatusDto {
  status: CrawlJobStatus;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
}
