import { prisma } from "../../database/prisma.client";
import { CrawlMode, ScheduleFrequency, Prisma } from "@prisma/client";
import { CrawlScheduleQueryDto } from "./crawl-schedule.dto";
import { DEFAULT_TIMEZONE } from "../../common/constants/timezone.constant";

export class CrawlScheduleRepository {
  create(data: {
    userId: string;
    name: string;
    startUrl: string;
    domain?: string;
    mode: CrawlMode;
    frequency: ScheduleFrequency;
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
    nextRunAt?: Date;
  }) {
    return prisma.crawlSchedule.create({
      data: {
        userId: data.userId,
        name: data.name,
        startUrl: data.startUrl,
        domain: data.domain,
        mode: data.mode,
        frequency: data.frequency,
        cronExpression: data.cronExpression,
        hour: data.hour ?? 0,
        minute: data.minute ?? 0,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        timezone: data.timezone ?? DEFAULT_TIMEZONE,
        maxPages: data.maxPages ?? 20,
        maxDepth: data.maxDepth ?? 1,
        urls: data.urls ?? [],
        isActive: data.isActive ?? true,
        autoDiff: data.autoDiff ?? true,
        nextRunAt: data.nextRunAt,
      },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      startUrl?: string;
      domain?: string;
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
      nextRunAt?: Date | null;
      lastRunAt?: Date | null;
    },
  ) {
    return prisma.crawlSchedule.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.crawlSchedule.delete({
      where: { id },
    });
  }

  findById(id: string) {
    return prisma.crawlSchedule.findUnique({
      where: { id },
    });
  }

  findAllByUser(userId: string, query: CrawlScheduleQueryDto = {}) {
    return this.find(query, userId);
  }

  findAll(query: CrawlScheduleQueryDto = {}) {
    return this.find(query);
  }

  private async find(query: CrawlScheduleQueryDto, userId?: string) {
    const where: Prisma.CrawlScheduleWhereInput = {};
    if (userId) {
      where.userId = userId;
    }
    if (query.frequency) {
      where.frequency = query.frequency;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { startUrl: { contains: query.search, mode: "insensitive" } },
        { domain: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const sortBy = query.sortBy || "createdAt";
    const order = (query.order || "desc") as Prisma.SortOrder;
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "name",
      "frequency",
      "nextRunAt",
      "lastRunAt",
      "isActive",
    ];
    const orderBy: Prisma.CrawlScheduleOrderByWithRelationInput =
      allowedSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { createdAt: "desc" };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.crawlSchedule.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.crawlSchedule.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findDueSchedules(targetDate: Date) {
    return prisma.crawlSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: targetDate },
      },
      include: {
        user: true,
      },
    });
  }

  updateNextRun(id: string, lastRunAt: Date, nextRunAt: Date) {
    return prisma.crawlSchedule.update({
      where: { id },
      data: {
        lastRunAt,
        nextRunAt,
      },
    });
  }

  async claimDueSchedule(
    id: string,
    now: Date,
    nextRunAt: Date,
  ): Promise<boolean> {
    const result = await prisma.crawlSchedule.updateMany({
      where: {
        id,
        isActive: true,
        nextRunAt: { lte: now },
      },
      data: {
        lastRunAt: now,
        nextRunAt,
      },
    });
    return result.count > 0;
  }
}
