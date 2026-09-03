import { prisma } from "../../database/prisma.client";
import { ROLES } from "../../common/constants/role.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { CrawlPageStatus } from "@prisma/client";

export class DashboardRepository {
  async getStats(userId: string, role: string) {
    const isGlobal = role === ROLES.ADMIN;
    const jobWhere = isGlobal ? {} : { userId };
    const pageWhere = isGlobal ? {} : { job: { userId } };
    const scheduleWhere = isGlobal ? {} : { userId };
    const exportWhere = isGlobal ? {} : { job: { userId } };

    const [
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      pendingJobs,
      totalPagesCrawled,
      successfulPages,
      failedPages,
      activeSchedules,
      totalSchedules,
      totalExports,
    ] = await Promise.all([
      prisma.crawlJob.count({ where: jobWhere }),
      prisma.crawlJob.count({
        where: { ...jobWhere, status: JOB_STATUS.COMPLETED },
      }),
      prisma.crawlJob.count({
        where: { ...jobWhere, status: JOB_STATUS.FAILED },
      }),
      prisma.crawlJob.count({
        where: { ...jobWhere, status: JOB_STATUS.RUNNING },
      }),
      prisma.crawlJob.count({
        where: {
          ...jobWhere,
          status: { in: [JOB_STATUS.PENDING, JOB_STATUS.QUEUED] },
        },
      }),
      prisma.crawlPage.count({ where: pageWhere }),
      prisma.crawlPage.count({
        where: { ...pageWhere, status: CrawlPageStatus.SUCCESS },
      }),
      prisma.crawlPage.count({
        where: { ...pageWhere, status: CrawlPageStatus.FAILED },
      }),
      prisma.crawlSchedule.count({
        where: { ...scheduleWhere, isActive: true },
      }),
      prisma.crawlSchedule.count({ where: scheduleWhere }),
      prisma.crawlExport.count({ where: exportWhere }),
    ]);

    return {
      jobs: {
        total: totalJobs,
        completed: completedJobs,
        failed: failedJobs,
        running: runningJobs,
        pending: pendingJobs,
      },
      pages: {
        total: totalPagesCrawled,
        successful: successfulPages,
        failed: failedPages,
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
