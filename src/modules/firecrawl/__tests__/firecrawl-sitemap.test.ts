// Mock axios for sitemap fetch and firecrawl client for batch scrape
jest.mock('axios');
jest.mock('../firecrawl.client');

import axios from 'axios';
import { getFirecrawlClient } from '../firecrawl.client';
import { FirecrawlService } from '../firecrawl.service';

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockGetClient = getFirecrawlClient as jest.Mock;

describe('FirecrawlService — sitemap methods', () => {
  let service: FirecrawlService;
  let mockClient: any;

  beforeEach(() => {
    service = new FirecrawlService();
    mockClient = {
      asyncBatchScrapeUrls: jest.fn(),
      checkBatchScrapeStatus: jest.fn(),
      checkBatchScrapeErrors: jest.fn(),
    };
    mockGetClient.mockReturnValue(mockClient);
    jest.clearAllMocks();
  });

  // ── parseSitemapUrls ────────────────────────────────────────────────────

  describe('parseSitemapUrls()', () => {
    it('extracts <loc> URLs from a valid sitemap', async () => {
      mockAxios.get.mockResolvedValue({
        data: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page-1</loc></url>
            <url><loc>https://example.com/page-2</loc></url>
          </urlset>`,
      });

      const urls = await (service as any).parseSitemapUrls('https://example.com/sitemap.xml');
      expect(urls).toEqual(['https://example.com/page-1', 'https://example.com/page-2']);
    });

    it('returns empty array when sitemap has no <loc> tags', async () => {
      mockAxios.get.mockResolvedValue({ data: '<urlset></urlset>' });
      const urls = await (service as any).parseSitemapUrls('https://example.com/sitemap.xml');
      expect(urls).toEqual([]);
    });

    it('throws when axios fetch fails', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));
      await expect((service as any).parseSitemapUrls('https://example.com/sitemap.xml'))
        .rejects.toThrow('Failed to fetch sitemap');
    });

    it('respects maxPages limit when provided', async () => {
      mockAxios.get.mockResolvedValue({
        data: `<urlset>
          <url><loc>https://example.com/1</loc></url>
          <url><loc>https://example.com/2</loc></url>
          <url><loc>https://example.com/3</loc></url>
        </urlset>`,
      });
      const urls = await (service as any).parseSitemapUrls('https://example.com/sitemap.xml', 2);
      expect(urls).toHaveLength(2);
    });
  });

  // ── batchScrapePages ────────────────────────────────────────────────────

  describe('batchScrapePages()', () => {
    const urls = ['https://example.com/1', 'https://example.com/2'];

    it('returns success:false when asyncBatchScrapeUrls fails', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: false, error: 'API error' });

      const result = await service.batchScrapePages(urls, 10);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/API error/);
    });

    it('returns success:false when asyncBatchScrapeUrls returns no id', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: true }); // no id
      const result = await service.batchScrapePages(urls, 10);
      expect(result.success).toBe(false);
    });

    it('polls until completed and returns pages', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: true, id: 'batch-123' });
      mockClient.checkBatchScrapeStatus
        .mockResolvedValueOnce({
          success: true,
          status: 'scraping',
          completed: 1,
          total: 2,
          data: [],
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          completed: 2,
          total: 2,
          data: [
            { url: 'https://example.com/1', markdown: '# Page 1', metadata: { statusCode: 200 }, success: true },
            { url: 'https://example.com/2', markdown: '# Page 2', metadata: { statusCode: 200 }, success: true },
          ],
        });
      mockClient.checkBatchScrapeErrors.mockResolvedValue({ errors: [], robotsBlocked: [] });

      const result = await service.batchScrapePages(urls, 10);
      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].url).toBe('https://example.com/1');
    });

    it('calls onProgress hook during polling', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: true, id: 'batch-456' });
      mockClient.checkBatchScrapeStatus.mockResolvedValue({
        success: true, status: 'completed', completed: 2, total: 2, data: [],
      });
      mockClient.checkBatchScrapeErrors.mockResolvedValue({ errors: [], robotsBlocked: [] });

      const onProgress = jest.fn();
      await service.batchScrapePages(urls, 10, onProgress);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('cancels when shouldCancel returns true before first poll', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: true, id: 'batch-789' });
      const shouldCancel = jest.fn().mockResolvedValue(true);

      const result = await service.batchScrapePages(urls, 10, undefined, shouldCancel);
      expect(result.success).toBe(false);
      expect(result.status).toBe('cancelled');
      expect(mockClient.checkBatchScrapeStatus).not.toHaveBeenCalled();
    });

    it('returns failed pages in failedUrls from checkBatchScrapeErrors', async () => {
      mockClient.asyncBatchScrapeUrls.mockResolvedValue({ success: true, id: 'batch-err' });
      mockClient.checkBatchScrapeStatus.mockResolvedValue({
        success: true, status: 'completed', completed: 1, total: 2, data: [
          { url: 'https://example.com/1', markdown: '# ok', metadata: { statusCode: 200 }, success: true },
        ],
      });
      mockClient.checkBatchScrapeErrors.mockResolvedValue({
        errors: [{ url: 'https://example.com/2', error: 'Timeout' }],
        robotsBlocked: [],
      });

      const result = await service.batchScrapePages(urls, 10);
      expect(result.failedUrls).toHaveLength(1);
      expect(result.failedUrls![0].url).toBe('https://example.com/2');
    });
  });
});