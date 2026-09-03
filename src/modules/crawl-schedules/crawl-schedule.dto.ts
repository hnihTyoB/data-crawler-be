import { CrawlMode } from "../../common/constants/crawl-mode.constant";
import { ScheduleFrequency } from "../../common/constants/schedule-frequency.constant";

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
  order?: "asc" | "desc";
}
