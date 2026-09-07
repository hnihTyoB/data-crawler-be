import { prisma } from "../../database/prisma.client";
import { ROLES } from "../../common/constants/role.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { CRAWL_PAGE_STATUS } from "../../common/constants/crawl-page-status.constant";

export class DashboardRepository {
  async getStats(userId: string, role: string) {
    const isGlobal = role === ROLES.ADMIN;
    const jobWhere = {
      deletedAt: null,
      ...(isGlobal ? {} : { userId }),
    };
    const pageWhere = {
      job: {
        deletedAt: null,
        ...(isGlobal ? {} : { userId }),
      },
    };
    const scheduleWhere = isGlobal ? {} : { userId };
    const exportWhere = {
      job: {
        deletedAt: null,
        ...(isGlobal ? {} : { userId }),
      },
    };

    const [
      jobStatusGroups,
      pageStatusGroups,
      totalPagesCrawled,
      activeSchedules,
      totalSchedules,
      totalExports,
    ] = await Promise.all([
      prisma.crawlJob.groupBy({
        by: ["status"],
        _count: { status: true },
        where: jobWhere,
      }),
      prisma.crawlPage.groupBy({
        by: ["status"],
        _count: { status: true },
        where: pageWhere,
      }),
      prisma.crawlPage.count({ where: pageWhere }),
      prisma.crawlSchedule.count({
        where: { ...scheduleWhere, isActive: true },
      }),
      prisma.crawlSchedule.count({ where: scheduleWhere }),
      prisma.crawlExport.count({ where: exportWhere }),
    ]);

    const jobCounts: Record<string, number> = {};
    let totalJobs = 0;
    for (const group of jobStatusGroups) {
      jobCounts[group.status] = group._count.status;
      totalJobs += group._count.status;
    }

    const pageCounts: Record<string, number> = {};
    for (const group of pageStatusGroups) {
      pageCounts[group.status] = group._count.status;
    }

    return {
      jobs: {
        total: totalJobs,
        completed: jobCounts[JOB_STATUS.COMPLETED] ?? 0,
        failed: jobCounts[JOB_STATUS.FAILED] ?? 0,
        running: jobCounts[JOB_STATUS.RUNNING] ?? 0,
        pending:
          (jobCounts[JOB_STATUS.PENDING] ?? 0) +
          (jobCounts[JOB_STATUS.QUEUED] ?? 0),
      },
      pages: {
        total: totalPagesCrawled,
        successful: pageCounts[CRAWL_PAGE_STATUS.SUCCESS] ?? 0,
        failed: pageCounts[CRAWL_PAGE_STATUS.FAILED] ?? 0,
      },
      schedules: {
        total: totalSchedules,
        active: activeSchedules,
      },
      exports: {
        total: totalExports,
      },
    };
  }
}
