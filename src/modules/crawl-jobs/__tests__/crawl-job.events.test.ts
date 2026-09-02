import { CrawlJobController } from '../crawl-job.controller';
import { CrawlJobService } from '../crawl-job.service';

jest.mock('../crawl-job.service');
jest.mock('../../audit-logs/audit-log.service');

describe('CrawlJobController - SSE Events', () => {
  let controller: CrawlJobController;
  let mockService: jest.Mocked<CrawlJobService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = {
      findById: jest.fn(),
    } as any;

    (CrawlJobService as jest.Mock).mockReturnValue(mockService);
    controller = new CrawlJobController();
  });

  it('sets text/event-stream headers and writes initial job data', async () => {
    mockService.findById.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
      totalPages: 10,
    } as any);

    const written: string[] = [];
    const headers: Record<string, string> = {};

    const req: any = {
      params: { id: 'job-1' },
      user: { id: 'user-1', role: 'CRAWLER_USER' },
      on: jest.fn(),
    };

    const res: any = {
      setHeader: jest.fn((k, v) => {
        headers[k] = v;
      }),
      write: jest.fn((chunk) => {
        written.push(chunk);
      }),
      flushHeaders: jest.fn(),
      end: jest.fn(),
    };
    const next = jest.fn();

    await controller.streamEvents(req, res, next);

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(written[0]).toContain('event: initial');
    expect(written[0]).toContain('"id":"job-1"');
    expect(written[1]).toContain('event: done');
    expect(res.end).toHaveBeenCalled();
  });
});
