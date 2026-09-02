import { AssetType, CrawlAsset, CrawlPage, CrawlPageStatus } from '@prisma/client';
import {
  buildPagesJsonEnvelope,
  transformPageToRecord,
  extractMainContent,
  transformImages,
} from '../data-contract.helper';
import { TableRecord } from '../../types/data-contract.types';

describe('Data Contract v1 pages.json', () => {
  const page = {
    id: 'page-id',
    jobId: 'job-id',
    url: 'HTTPS://Example.com/article/?utm_source=test&b=2&a=1#section',
    normalizedUrl: '',
    title: 'Example article',
    description: 'Article description',
    markdownContent: '# Example article\n\nUseful **content** for FE and AI.',
    htmlContentPath: null,
    content: null,
    status: CrawlPageStatus.SUCCESS,
    statusCode: 200,
    errorMessage: null,
    hasSensitiveData: false,
    contentHash: null,
    wordCount: 0,
    dataQualityScore: null,
    warnings: [],
    crawledAt: new Date('2026-07-20T07:00:00.000Z'),
    createdAt: new Date('2026-07-20T06:59:00.000Z'),
    updatedAt: new Date('2026-07-20T07:00:00.000Z'),
    structuredData: null,
  } as CrawlPage;

  const assets: CrawlAsset[] = [
    {
      id: 'link-id',
      pageId: page.id,
      crawlJobId: page.jobId,
      assetType: AssetType.LINK,
      url: 'https://example.com/next',
      sourceUrl: page.url,
      altText: null,
      mimeType: null,
      orderIndex: null,
      cssSelector: null,
      domPath: null,
      createdAt: new Date('2026-07-20T07:00:00.000Z'),
    },
    {
      id: 'image-id',
      pageId: page.id,
      crawlJobId: page.jobId,
      assetType: AssetType.IMAGE,
      url: 'https://cdn.example.com/hero.webp',
      sourceUrl: page.url,
      altText: 'Hero',
      mimeType: 'image/webp',
      orderIndex: 1,
      cssSelector: null,
      domPath: null,
      createdAt: new Date('2026-07-20T07:00:00.000Z'),
    },
  ];

  const tables: TableRecord[] = [{
    tableIndex: 0,
    headers: ['Name', 'Value'],
    rowsCount: 2,
    colsCount: 2,
    sheetName: 'Table-P-article-1',
  }];

  it('exports every required page field with stable FE/AI-friendly shapes', () => {
    const record = transformPageToRecord({
      page,
      assets,
      tables,
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });

    expect(Object.keys(record)).toEqual([
      'id', 'jobId', 'url', 'normalizedUrl', 'status', 'statusCode',
      'errorMessage', 'title', 'description', 'rawMarkdown', 'cleanText',
      'mainContent', 'wordCount', 'contentHash', 'dataQualityScore',
      'warnings', 'links', 'images', 'tables', 'crawledAt',
    ]);
    expect(record.normalizedUrl).toBe('https://example.com/article?a=1&b=2');
    expect(record.rawMarkdown).toBe(page.markdownContent);
    expect(record.cleanText).toBe('Example article\n\nUseful content for FE and AI.');
    expect(record.mainContent).toBe(page.markdownContent);
    expect(record.links).toEqual([{
      url: 'https://example.com/next',
      sourceUrl: page.url,
      type: 'internal',
    }]);
    expect(record.images).toEqual([{
      sourceUrl: 'https://cdn.example.com/hero.webp',
      altText: 'Hero',
      orderIndex: 1,
      type: 'image/webp',
    }]);
    expect(record.tables).toEqual(tables);
    expect(Array.isArray(record.warnings)).toBe(true);
  });

  it('wraps pages with the documented semantic schema version', () => {
    const envelope = buildPagesJsonEnvelope(page.jobId, [{ id: page.id }]);

    expect(envelope).toMatchObject({
      schemaVersion: '1.0.0',
      jobId: page.jobId,
      totalRecords: 1,
      pages: [{ id: page.id }],
    });
    expect(Number.isNaN(Date.parse(envelope.exportedAt))).toBe(false);
  });
});
describe('extractMainContent()', () => {
  it('returns empty string for null/undefined input', () => {
    expect(extractMainContent(null)).toBe('');
    expect(extractMainContent(undefined)).toBe('');
  });

  it('keeps normal article content unchanged', () => {
    const md = '# Article\n\nThis is useful content about the topic.\n\nMore paragraphs here.';
    expect(extractMainContent(md)).toBe(md);
  });

  it('removes nav list items matching keyword list', () => {
    const md = '# Page\n\n* [Home](https://example.com)\n* [About](https://example.com/about)\n\nReal content here.';
    const result = extractMainContent(md);
    expect(result).not.toContain('[Home]');
    expect(result).not.toContain('[About]');
    expect(result).toContain('Real content here.');
  });

  it('removes social media list items', () => {
    const md = '# Follow us\n\n* [Twitter](https://twitter.com/us)\n* [Facebook](https://facebook.com/us)\n\nActual article content.';
    const result = extractMainContent(md);
    expect(result).not.toContain('[Twitter]');
    expect(result).not.toContain('[Facebook]');
    expect(result).toContain('Actual article content.');
  });

  it('removes copyright and all rights reserved lines', () => {
    const md = '# Article\n\nContent here.\n\n© 2024 Company Inc.\nAll rights reserved.';
    const result = extractMainContent(md);
    expect(result).not.toContain('©');
    expect(result).not.toContain('All rights reserved');
    expect(result).toContain('Content here.');
  });

  it('removes sidebar section headers', () => {
    const md = '# Main Article\n\nContent.\n\n### Related Posts\n\n* [Post 1](https://example.com/1)';
    const result = extractMainContent(md);
    expect(result).not.toContain('Related Posts');
  });

  it('removes lines repeated 3 or more times', () => {
    const md = 'Read more\nContent paragraph.\nRead more\nAnother paragraph.\nRead more';
    const result = extractMainContent(md);
    expect(result).not.toContain('Read more');
    expect(result).toContain('Content paragraph.');
  });

  it('keeps content when no boilerplate present', () => {
    const md = '# Title\n\nParagraph one.\n\nParagraph two with [a link](https://example.com/article/long-slug).';
    expect(extractMainContent(md)).toBe(md);
  });
});
// ─────────────────────────────────────────────
// BE2-D07 — transformPageToRecord() integration scenarios
// ─────────────────────────────────────────────

describe('transformPageToRecord() — noisy page (NAV_NOISE warning)', () => {
  // A page where >30% of lines are stripped by extractMainContent triggers NAV_NOISE.
  // We need enough lines so the ratio check fires:
  // originalLinesCount > 10 AND (stripped / original) > 0.3

  const makeNavNoisyPage = (): CrawlPage  => {
    // 20 lines total: 8 nav list items (stripped) + 4 real content lines = 40% stripped
    const navBlock = [
      '* [Home](https://example.com)',
      '* [About](https://example.com/about)',
      '* [Contact](https://example.com/contact)',
      '* [Login](https://example.com/login)',
      '* [Blog](https://example.com/blog)',
      '* [FAQ](https://example.com/faq)',
      '* [Search](https://example.com/search)',
      '* [Cart](https://example.com/cart)',
    ].join('\n');

    const content = [
      '# Real Article Title',
      '',
      'This is the actual article content that matters.',
      'It has multiple sentences and real information.',
      'Users come to read this, not the nav.',
      'More content here to ensure wordCount is healthy.',
      '',
      '## Section Two',
      '',
      'Another paragraph of real content here.',
      'Enough lines to push originalLinesCount above 10.',
      'And the nav items above should be stripped.',
    ].join('\n');

    return {
      id: 'nav-page-id',
      jobId: 'job-nav',
      url: 'https://example.com/article',
      normalizedUrl: "",
      title: 'Real Article',
      description: 'Real description',
      markdownContent: navBlock + '\n' + content,
      htmlContentPath: null,
      content: null,
      status: CrawlPageStatus.SUCCESS,
      statusCode: 200,
      errorMessage: null,
      hasSensitiveData: false,
      contentHash: null,
      wordCount: 0,
      dataQualityScore: null,
      warnings: [],
      crawledAt: new Date('2026-07-21T08:00:00.000Z'),
      createdAt: new Date('2026-07-21T08:00:00.000Z'),
      updatedAt: new Date('2026-07-21T08:00:00.000Z'),
    structuredData: null,
    } as CrawlPage;
  };

  it('adds NAV_NOISE warning when nav items exceed 30% of content', () => {
    const record = transformPageToRecord({
      page: makeNavNoisyPage(),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.warnings).toContain('NAV_NOISE');
  });

  it('mainContent still contains the real article body after stripping nav', () => {
    const record = transformPageToRecord({
      page: makeNavNoisyPage(),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.mainContent).toContain('Real Article Title');
    expect(record.mainContent).not.toContain('[Home]');
    expect(record.mainContent).not.toContain('[Login]');
  });

  it('wordCount is based on cleaned content, not raw nav-inclusive markdown', () => {
    const rawPage = makeNavNoisyPage();
    const record = transformPageToRecord({
      page: rawPage,
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    // Nav items stripped → wordCount should be less than full raw word count
    const rawWordCount = (rawPage.markdownContent ?? '').split(/\s+/).filter(Boolean).length;
    expect(record.wordCount).toBeLessThan(rawWordCount);
    expect(record.wordCount).toBeGreaterThan(0);
  });
});

describe('transformPageToRecord() — relative links', () => {
  const basePage = {
    id: 'rel-page-id',
    jobId: 'job-rel',
    url: 'https://example.com/article',
    normalizedUrl: "",
    title: 'Test',
    description: 'Test',
    markdownContent: '# Test\n\nContent.',
    htmlContentPath: null,
    content: null,
    status: CrawlPageStatus.SUCCESS,
    statusCode: 200,
    errorMessage: null,
    hasSensitiveData: false,
    contentHash: null,
    wordCount: 0,
    dataQualityScore: null,
    warnings: [],
    crawledAt: new Date('2026-07-21T08:00:00.000Z'),
    createdAt: new Date('2026-07-21T08:00:00.000Z'),
    updatedAt: new Date('2026-07-21T08:00:00.000Z'),
    structuredData: null,
  } as CrawlPage;

  const makeAsset = (url: string, id: string): CrawlAsset => ({
    id,
    pageId: basePage.id,
    crawlJobId: basePage.jobId,
    assetType: AssetType.LINK,
    url,
    sourceUrl: basePage.url,
    altText: null,
    mimeType: null,
    orderIndex: null,
    cssSelector: null,
    domPath: null,
    createdAt: new Date('2026-07-21T08:00:00.000Z'),
  });

  it('relative link stored as-is (invalid URL) is classified as external and does not throw', () => {
    // Firecrawl may store relative paths like "/about" or "../page" in assets.
    // transformLinks must not crash on these — new URL() will throw.
    const assets = [makeAsset('/about', 'rel-1'), makeAsset('../other', 'rel-2')];
    expect(() =>
      transformPageToRecord({
        page: basePage,
        assets,
        jobDomain: 'example.com',
        seenContentHashes: new Set(),
      })
    ).not.toThrow();
  });

  it('relative link falls back to "external" type when URL parse fails', () => {
    const assets = [makeAsset('/about', 'rel-1')];
    const record = transformPageToRecord({
      page: basePage,
      assets,
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.links[0].type).toBe('external');
  });

  it('absolute internal link is correctly classified as internal', () => {
    const assets = [makeAsset('https://example.com/internal-page', 'abs-int')];
    const record = transformPageToRecord({
      page: basePage,
      assets,
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.links[0].type).toBe('internal');
  });

  it('absolute external link is correctly classified as external', () => {
    const assets = [makeAsset('https://other.com/page', 'abs-ext')];
    const record = transformPageToRecord({
      page: basePage,
      assets,
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.links[0].type).toBe('external');
  });

  it('subdomain of jobDomain is classified as internal', () => {
    const assets = [makeAsset('https://blog.example.com/post', 'sub-1')];
    const record = transformPageToRecord({
      page: basePage,
      assets,
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.links[0].type).toBe('internal');
  });
});

describe('transformImages() — duplicate image deduplication', () => {
  const makeImageAsset = (url: string, id: string, orderIndex: number | null = null): CrawlAsset => ({
    id,
    pageId: 'page-1',
    crawlJobId: 'job-1',
    assetType: AssetType.IMAGE,
    url,
    sourceUrl: 'https://example.com/page',
    altText: 'Logo',
    mimeType: 'image/png',
    orderIndex,
    cssSelector: null,
    domPath: null,
    createdAt: new Date('2026-07-21T08:00:00.000Z'),
  });

  it('deduplicates images with the same URL — keeps first occurrence', () => {
    const assets = [
      makeImageAsset('https://cdn.example.com/logo.png', 'img-1', 1),
      makeImageAsset('https://cdn.example.com/logo.png', 'img-2', 2), // duplicate
      makeImageAsset('https://cdn.example.com/logo.png', 'img-3', 3), // duplicate
    ];
    const result = transformImages(assets);
    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe('https://cdn.example.com/logo.png');
    expect(result[0].orderIndex).toBe(1); // first occurrence's orderIndex
  });

  it('keeps distinct URLs as separate records', () => {
    const assets = [
      makeImageAsset('https://cdn.example.com/logo.png', 'img-1', 1),
      makeImageAsset('https://cdn.example.com/hero.jpg', 'img-2', 2),
      makeImageAsset('https://cdn.example.com/thumb.webp', 'img-3', 3),
    ];
    const result = transformImages(assets);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no IMAGE assets present', () => {
    const assets: CrawlAsset[] = [
      {
        id: 'link-1',
        pageId: 'page-1',
        crawlJobId: 'job-1',
        assetType: AssetType.LINK,
        url: 'https://example.com/page',
        sourceUrl: null,
        altText: null,
        mimeType: null,
        orderIndex: null,
        cssSelector: null,
        domPath: null,
        createdAt: new Date(),
      },
    ];
    expect(transformImages(assets)).toEqual([]);
  });

  it('falls back to array index when orderIndex is null', () => {
    const assets = [
      makeImageAsset('https://cdn.example.com/a.png', 'img-1', null),
      makeImageAsset('https://cdn.example.com/b.png', 'img-2', null),
    ];
    const result = transformImages(assets);
    expect(result[0].orderIndex).toBe(1);
    expect(result[1].orderIndex).toBe(2);
  });

  it('mixed: first duplicate is null orderIndex, second has value — keeps first (null → index fallback)', () => {
    const assets = [
      makeImageAsset('https://cdn.example.com/logo.png', 'img-1', null), // first: null
      makeImageAsset('https://cdn.example.com/logo.png', 'img-2', 5),    // duplicate: skipped
    ];
    const result = transformImages(assets);
    expect(result).toHaveLength(1);
    expect(result[0].orderIndex).toBe(1); // null → index fallback = 1 (0+1)
  });
});

describe('transformPageToRecord() — DUPLICATE_CONTENT warning', () => {
  const makePage = (id: string, content: string): CrawlPage => ({
    id,
    jobId: 'job-dup',
    url: `https://example.com/${id}`,
    normalizedUrl: "",
    title: 'Title',
    description: 'Desc',
    markdownContent: content,
    htmlContentPath: null,
    content: null,
    status: CrawlPageStatus.SUCCESS,
    statusCode: 200,
    errorMessage: null,
    hasSensitiveData: false,
    contentHash: null,
    wordCount: 0,
    dataQualityScore: null,
    warnings: [],
    crawledAt: new Date('2026-07-21T08:00:00.000Z'),
    createdAt: new Date('2026-07-21T08:00:00.000Z'),
    updatedAt: new Date('2026-07-21T08:00:00.000Z'),
    structuredData: null,
  } as CrawlPage);

  const CONTENT = '# Same Article\n\nThis is identical content on two different URLs. It has enough words to hash.';

  it('first page with unique content has no DUPLICATE_CONTENT warning', () => {
    const seenContentHashes = new Set<string>();
    const record = transformPageToRecord({
      page: makePage('page-1', CONTENT),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    expect(record.warnings).not.toContain('DUPLICATE_CONTENT');
  });

  it('second page with identical content gets DUPLICATE_CONTENT warning', () => {
    const seenContentHashes = new Set<string>();
    // Process first page — populates the set
    transformPageToRecord({
      page: makePage('page-1', CONTENT),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    // Process second page with same content
    const record = transformPageToRecord({
      page: makePage('page-2', CONTENT),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    expect(record.warnings).toContain('DUPLICATE_CONTENT');
  });

  it('different content on two pages produces no DUPLICATE_CONTENT warning', () => {
    const seenContentHashes = new Set<string>();
    transformPageToRecord({
      page: makePage('page-1', '# Article One\n\nUnique content for first page here.'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    const record = transformPageToRecord({
      page: makePage('page-2', '# Article Two\n\nCompletely different content for second page.'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    expect(record.warnings).not.toContain('DUPLICATE_CONTENT');
  });
});

describe('transformPageToRecord() — error pages (non-SUCCESS status)', () => {
  const makeErrorPage = (
    status: CrawlPageStatus,
    statusCode: number | null,
    errorMessage: string | null,
  ): CrawlPage  => ({
    id: 'err-page-id',
    jobId: 'job-err',
    url: 'https://example.com/not-found',
    normalizedUrl: "",
    title: null,
    description: null,
    markdownContent: null,
    htmlContentPath: null,
    content: null,
    status,
    statusCode,
    errorMessage,
    hasSensitiveData: false,
    contentHash: null,
    wordCount: 0,
    dataQualityScore: null,
    warnings: [],
    crawledAt: new Date('2026-07-21T08:00:00.000Z'),
    createdAt: new Date('2026-07-21T08:00:00.000Z'),
    updatedAt: new Date('2026-07-21T08:00:00.000Z'),
    structuredData: null,
  } as CrawlPage);

  it('FAILED page (404) has null dataQualityScore', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 404, 'Không tìm thấy trang'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.dataQualityScore).toBeNull();
  });

  it('FAILED page (500) has null dataQualityScore', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 500, 'Lỗi máy chủ'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.dataQualityScore).toBeNull();
  });

  it('BLOCKED page has null dataQualityScore', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.BLOCKED, 403, 'Cloudflare block'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.dataQualityScore).toBeNull();
  });

  it('error page with null markdown has wordCount 0 and null contentHash', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 404, 'Not found'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.wordCount).toBe(0);
    expect(record.contentHash).toBeNull();
  });

  it('error page with null markdown has null mainContent and null cleanText', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 404, 'Not found'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.mainContent).toBeNull();
    expect(record.cleanText).toBeNull();
  });

  it('error page does NOT get added to seenContentHashes (null hash not tracked)', () => {
    const seenContentHashes = new Set<string>();
    transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 404, null),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes,
    });
    expect(seenContentHashes.size).toBe(0);
  });

  it('preserves status, statusCode, and errorMessage from DB on error page', () => {
    const record = transformPageToRecord({
      page: makeErrorPage(CrawlPageStatus.FAILED, 404, 'Không tìm thấy trang'),
      assets: [],
      jobDomain: 'example.com',
      seenContentHashes: new Set(),
    });
    expect(record.status).toBe('FAILED');
    expect(record.statusCode).toBe(404);
    expect(record.errorMessage).toBe('Không tìm thấy trang');
  });
});