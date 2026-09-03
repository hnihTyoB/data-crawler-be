import { CrawlExportService } from '../crawl-export.service';
import { CrawlExportRepository } from '../crawl-export.repository';
import { CrawlJobRepository } from '../../crawl-jobs/crawl-job.repository';
import { StorageFactory } from '../../../common/storage/storage.factory';

jest.mock('../crawl-export.repository');
jest.mock('../../crawl-jobs/crawl-job.repository');
jest.mock('../../../common/storage/storage.factory');

describe('CrawlExportService findAllByUser and delete', () => {
  const mockStorage = {
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (StorageFactory.getStorageService as jest.Mock).mockReturnValue(mockStorage);
  });

  const mockExport = {
    id: 'exp-123',
    jobId: 'job-123',
    filePath: 'exports/job-123.zip',
    fileName: 'export.zip',
  };

  it('lists exports for authenticated user', async () => {
    const service = new CrawlExportService();
    (CrawlExportRepository.prototype.findAllByUser as jest.Mock).mockResolvedValue({
      items: [mockExport],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await service.findAllByUser('user-1', 1, 20);

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('exp-123');
  });

  it('deletes export file from storage and database', async () => {
    const service = new CrawlExportService();
    jest.spyOn(service, 'findById').mockResolvedValue(mockExport as any);
    (CrawlExportRepository.prototype.delete as jest.Mock).mockResolvedValue(mockExport);

    const result = await service.delete('user-1', 'CRAWLER_USER', 'exp-123');

    expect(result.success).toBe(true);
    expect(mockStorage.deleteFile).toHaveBeenCalledWith('exports/job-123.zip');
    expect(CrawlExportRepository.prototype.delete).toHaveBeenCalledWith('exp-123');
  });
});
