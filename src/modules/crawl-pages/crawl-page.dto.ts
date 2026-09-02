import { CrawlPageStatus } from '@prisma/client';

export interface CreateCrawlPageDto {
  jobId: string;
  url: string;
  title?: string;
  description?: string;
  markdownContent?: string;
  htmlContentPath?: string;
  status?: CrawlPageStatus;
  statusCode?: number;
  errorMessage?: string;
  crawledAt?: Date;
}

export interface UpdateCrawlPageDto {
  title?: string;
  description?: string;
  markdownContent?: string;
  htmlContentPath?: string;
  status?: CrawlPageStatus;
  statusCode?: number;
  errorMessage?: string;
  crawledAt?: Date;
}

export interface CrawlPageQueryDto {
  status?: CrawlPageStatus;
  statusCode?: string | number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: string | number;
  limit?: string | number;
  dataQualityScore?: string | number;
  minDataQualityScore?: string | number;
  maxDataQualityScore?: string | number;
  qualityScore?: string | number;
  minQualityScore?: string | number;
  maxQualityScore?: string | number;
  hasImages?: string | boolean;
  hasLinks?: string | boolean;
  hasTables?: string | boolean;
  contentLength?: string | number;
  minContentLength?: string | number;
  maxContentLength?: string | number;
  wordCount?: string | number;
  minWordCount?: string | number;
  maxWordCount?: string | number;
  preview?: string | boolean;
}

