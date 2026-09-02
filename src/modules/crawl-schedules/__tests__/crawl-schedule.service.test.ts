jest.mock('../../../database/prisma.client', () => ({
  prisma: {},
}));

jest.mock('../crawl-schedule.repository');
jest.mock('../../crawl-jobs/crawl-job.repository');
jest.mock('../../../common/helpers/url.helper');
jest.mock('../../../queues/crawl.queue', () => ({
  crawlQueue: {
    add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
  },
}));

import { CrawlScheduleService } from '../crawl-schedule.service';
import { CrawlScheduleRepository } from '../crawl-schedule.repository';
import { CrawlJobRepository } from '../../crawl-jobs/crawl-job.repository';
import * as urlHelper from '../../../common/helpers/url.helper';
import { crawlQueue } from '../../../queues/crawl.queue';

describe('CrawlScheduleService', () => {
  let service: CrawlScheduleService;
  let mockScheduleRepo: jest.Mocked<CrawlScheduleRepository>;
  let mockJobRepo: jest.Mocked<CrawlJobRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleRepo = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findAllByUser: jest.fn(),
      findAll: jest.fn(),
      findDueSchedules: jest.fn(),
      updateNextRun: jest.fn(),
    } as any;

    mockJobRepo = {
      create: jest.fn(),
      findByScheduleId: jest.fn(),
    } as any;

    (CrawlScheduleRepository as jest.Mock).mockReturnValue(mockScheduleRepo);
    (CrawlJobRepository as jest.Mock).mockReturnValue(mockJobRepo);
    (urlHelper.validateUrl as jest.Mock).mockImplementation((url: string) => new URL(url));
    (urlHelper.extractDomain as jest.Mock).mockReturnValue('example.com');
    (urlHelper.validateUrlAsync as jest.Mock).mockResolvedValue(undefined);

    service = new CrawlScheduleService();
  });

  const mockSchedule = {
    id: 'schedule-1',
    userId: 'user-1',
    name: 'Daily Crawl',
    startUrl: 'https://example.com',
    domain: 'example.com',
    mode: 'SCRAPE' as const,
    frequency: 'DAILY' as const,
    cronExpression: null,
    hour: 2,
    minute: 0,
    dayOfWeek: null,
    dayOfMonth: null,
    timezone: 'UTC',
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    isActive: true,
    autoDiff: true,
    lastRunAt: null,
    nextRunAt: new Date('2026-09-03T02:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('creates a DAILY schedule and computes initial nextRunAt', async () => {
      mockScheduleRepo.create.mockResolvedValue(mockSchedule as any);

      const result = await service.create('user-1', 'CRAWLER_USER', {
        name: 'Daily Crawl',
        startUrl: 'https://example.com',
        frequency: 'DAILY',
        hour: 2,
        minute: 0,
      });

      expect(mockScheduleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          name: 'Daily Crawl',
          frequency: 'DAILY',
          nextRunAt: expect.any(Date),
        }),
      );
      expect(result.id).toBe('schedule-1');
    });

    it('creates a WEEKLY schedule', async () => {
      mockScheduleRepo.create.mockResolvedValue({
        ...mockSchedule,
        frequency: 'WEEKLY',
        dayOfWeek: 1,
      } as any);

      await service.create('user-1', 'CRAWLER_USER', {
        name: 'Weekly Crawl',
        startUrl: 'https://example.com',
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        hour: 8,
        minute: 30,
      });

      expect(mockScheduleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'WEEKLY',
          dayOfWeek: 1,
        }),
      );
    });

    it('validates URLs for URL_LIST mode', async () => {
      mockScheduleRepo.create.mockResolvedValue({
        ...mockSchedule,
        mode: 'URL_LIST',
      } as any);

      await service.create('user-1', 'CRAWLER_USER', {
        name: 'List Schedule',
        startUrl: 'https://example.com/1',
        mode: 'URL_LIST',
        urls: ['https://example.com/1', 'https://example.com/2'],
      });

      expect(urlHelper.validateUrlAsync).toHaveBeenCalledTimes(2);
      expect(mockScheduleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'URL_LIST',
          urls: ['https://example.com/1', 'https://example.com/2'],
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns schedule for owner', async () => {
      mockScheduleRepo.findById.mockResolvedValue(mockSchedule as any);

      const result = await service.findById('user-1', 'CRAWLER_USER', 'schedule-1');
      expect(result.id).toBe('schedule-1');
    });

    it('returns schedule for admin regardless of owner', async () => {
      mockScheduleRepo.findById.mockResolvedValue(mockSchedule as any);

      const result = await service.findById('admin-1', 'ADMIN', 'schedule-1');
      expect(result.id).toBe('schedule-1');
    });

    it('throws 404 when schedule does not exist', async () => {
      mockScheduleRepo.findById.mockResolvedValue(null);

      await expect(
        service.findById('user-1', 'CRAWLER_USER', 'non-existent'),
      ).rejects.toThrow('not found');
    });

    it('throws 404 when user does not own the schedule', async () => {
      mockScheduleRepo.findById.mockResolvedValue(mockSchedule as any);

      await expect(
        service.findById('other-user', 'CRAWLER_USER', 'schedule-1'),
      ).rejects.toThrow('not found');
    });
  });

  describe('triggerRun', () => {
    it('creates CrawlJob, enqueues to BullMQ, and updates nextRunAt', async () => {
      mockScheduleRepo.findById.mockResolvedValue(mockSchedule as any);
      mockJobRepo.create.mockResolvedValue({ id: 'job-created-1' } as any);
      mockScheduleRepo.updateNextRun.mockResolvedValue({} as any);

      const job = await service.triggerRun('user-1', 'CRAWLER_USER', 'schedule-1');

      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          startUrl: 'https://example.com',
          scheduleId: 'schedule-1',
        }),
      );
      expect(crawlQueue?.add).toHaveBeenCalledWith('crawl-job', { jobId: 'job-created-1' });
      expect(mockScheduleRepo.updateNextRun).toHaveBeenCalledWith(
        'schedule-1',
        expect.any(Date),
        expect.any(Date),
      );
      expect(job.id).toBe('job-created-1');
    });
  });

  describe('processDueSchedules', () => {
    it('finds and triggers all due active schedules', async () => {
      mockScheduleRepo.findDueSchedules.mockResolvedValue([mockSchedule] as any);
      mockJobRepo.create.mockResolvedValue({ id: 'job-due-1' } as any);
      mockScheduleRepo.updateNextRun.mockResolvedValue({} as any);

      const count = await service.processDueSchedules();

      expect(count).toBe(1);
      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: 'schedule-1',
        }),
      );
      expect(crawlQueue?.add).toHaveBeenCalledWith('crawl-job', { jobId: 'job-due-1' });
      expect(mockScheduleRepo.updateNextRun).toHaveBeenCalled();
    });
  });
});
