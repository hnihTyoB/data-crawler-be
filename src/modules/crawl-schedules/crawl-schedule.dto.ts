import { CrawlMode, ScheduleFrequency } from '@prisma/client';

export interface CreateCrawlScheduleDto {
  name: string;
  startUrl: string;
  mode?: CrawlMode;
  frequency?: ScheduleFrequency;
  cronExpression?: string;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  maxPages?: number;
  maxDepth?: number;
  urls?: string[];
  isActive?: boolean;
  autoDiff?: boolean;
}

export interface UpdateCrawlScheduleDto {
  name?: string;
  startUrl?: string;
  mode?: CrawlMode;
  frequency?: ScheduleFrequency;
  cronExpression?: string;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  maxPages?: number;
  maxDepth?: number;
  urls?: string[];
  isActive?: boolean;
  autoDiff?: boolean;
}

export interface CrawlScheduleQueryDto {
  search?: string;
  frequency?: ScheduleFrequency;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}
