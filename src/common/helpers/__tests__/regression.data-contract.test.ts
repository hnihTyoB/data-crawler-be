import { AssetType, CrawlAsset, CrawlPage, CrawlPageStatus } from '@prisma/client';
import {
  transformPageToRecord,
  transformLinks,
  transformImages,
  extractMainContent,
} from '../data-contract.helper';

// ─────────────────────────────────────────────
// Shared sample data (regression fixtures)
// ─────────────────────────────────────────────

const SAMPLE_JOB_DOMAIN = 'example.com';

const makePage = (overrides: Partial<CrawlPage> = {}): CrawlPage & { normalizedUrl?: string | null } => ({
  id: 'page-regression-01',
  jobId: 'job-regression-01',
  url: 'https://example.com/article/deep-dive',
  normalizedUrl: 'https://example.com/article/deep-dive',
  title: 'Deep Dive Into Web Crawling',
  description: 'A comprehensive guide to scraping the web efficiently.',
  markdownContent: [
    '# Deep Dive Into Web Crawling',
    '',
    'This is a detailed article about crawling techniques.',
    'It covers multiple strategies and best practices.',
    '',
    '## Introduction',
    '',
    'Crawling requires understanding robots.txt and rate limiting.',
    '',
    '* [Home](https://example.com)',
    '* [About](https://example.com/about)',
    '* [Contact](https://example.com/contact)',
    '',
    '© 2024 Example Corp. All rights reserved.',
  ].join('\n'),
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
  createdAt: new Date('2026-07-21T07:59:00.000Z'),
  updatedAt: new Date('2026-07-21T08:00:00.000Z'),
  structuredData: null,
  ...overrides,
});

const makeLinkAsset = (url: string, sourceUrl: string = 'https://example.com/article/deep-dive'): CrawlAsset => ({
  id: `link-${url}`,
  pageId: 'page-regression-01',
  crawlJobId: 'job-regression-01',
  assetType: AssetType.LINK,
  url,
  sourceUrl,
  altText: null,
  mimeType: null,
  orderIndex: null,
  cssSelector: null,
  domPath: null,
  createdAt: new Date('2026-07-21T08:00:00.000Z'),
});

const makeImageAsset = (url: string, altText: string | null = null): CrawlAsset => ({
  id: `image-${url}`,
  pageId: 'page-regression-01',
  crawlJobId: 'job-regression-01',
  assetType: AssetType.IMAGE,
  url,
  sourceUrl: 'https://example.com/article/deep-dive',
  altText,
  mimeType: 'image/png',
  orderIndex: 1,
  cssSelector: null,
  domPath: null,
  createdAt: new Date('2026-07-21T08:00:00.000Z'),
});

// ─────────────────────────────────────────────
// Regression: links không rỗng khi có asset LINK
// ─────────────────────────────────────────────

describe('Regression: links extraction', () => {
  const linkAssets: CrawlAsset[] = [
    makeLinkAsset('https://example.com/next-page'),
    makeLinkAsset('https://external.com/resource'),
  ];

  it('should NOT return empty links when LINK assets exist', () => {
    const links = transformLinks(linkAssets, SAMPLE_JOB_DOMAIN);
    expect(links.length).toBeGreaterThan(0);
  });

  it('classifies internal link correctly', () => {
    const links = transformLinks(linkAssets, SAMPLE_JOB_DOMAIN);
    const internal = links.find((l) => l.url === 'https://example.com/next-page');
    expect(internal).toBeDefined();
    expect(internal?.type).toBe('internal');
  });

  it('classifies external link correctly', () => {
    const links = transformLinks(linkAssets, SAMPLE_JOB_DOMAIN);
    const external = links.find((l) => l.url === 'https://external.com/resource');
    expect(external).toBeDefined();
    expect(external?.type).toBe('external');
  });

  it('each link has url and sourceUrl fields', () => {
    const links = transformLinks(linkAssets, SAMPLE_JOB_DOMAIN);
    for (const link of links) {
      expect(link.url).toBeTruthy();
      expect(link.sourceUrl).toBeDefined();
      expect(['internal', 'external']).toContain(link.type);
    }
  });

  it('returns empty array when no LINK assets provided', () => {
    const noLinks = transformLinks([], SAMPLE_JOB_DOMAIN);
    expect(noLinks).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Regression: images deduplicate
// ─────────────────────────────────────────────

describe('Regression: images deduplication', () => {
  const duplicatedImageUrl = 'https://cdn.example.com/hero.png';
  const imageAssets: CrawlAsset[] = [
    makeImageAsset(duplicatedImageUrl, 'Hero image'),
    makeImageAsset(duplicatedImageUrl, 'Hero image duplicate'),  // same URL
    makeImageAsset('https://cdn.example.com/secondary.jpg', 'Secondary'),
  ];

  it('deduplicates images with the same URL', () => {
    const images = transformImages(imageAssets);
    const urls = images.map((i) => i.sourceUrl);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  });

  it('keeps only the first occurrence of a duplicated image', () => {
    const images = transformImages(imageAssets);
    const hero = images.filter((i) => i.sourceUrl === duplicatedImageUrl);
    expect(hero).toHaveLength(1);
    expect(hero[0].altText).toBe('Hero image');
  });

  it('does NOT return empty when images exist', () => {
    const images = transformImages(imageAssets);
    expect(images.length).toBeGreaterThan(0);
  });

  it('includes all unique image URLs', () => {
    const images = transformImages(imageAssets);
    const urls = images.map((i) => i.sourceUrl);
    expect(urls).toContain('https://cdn.example.com/hero.png');
    expect(urls).toContain('https://cdn.example.com/secondary.jpg');
  });
});

// ─────────────────────────────────────────────
// Regression: mainContent không lẫn menu nặng
// ─────────────────────────────────────────────

describe('Regression: mainContent nav noise removal', () => {
  const navHeavyMarkdown = [
    '# Article Title',
    '',
    'Real article content goes here with enough words to be meaningful.',
    '',
    '## Section',
    '',
    'More substantive content about the topic.',
    '',
    // Nav block — should be removed
    '* [Home](https://example.com)',
    '* [About](https://example.com/about)',
    '* [Contact](https://example.com/contact)',
    '* [Login](https://example.com/login)',
    '* [Register](https://example.com/register)',
    '* [Blog](https://example.com/blog)',
    '* [Twitter](https://twitter.com/us)',
    '* [Facebook](https://facebook.com/us)',
    '* [Instagram](https://instagram.com/us)',
    '',
    // Footer — should be removed
    '© 2024 Example Corp. All rights reserved.',
    '',
    // Sidebar — should be removed
    '### Related Posts',
    '### Tags',
    '### Newsletter',
  ].join('\n');

  it('preserves main article content', () => {
    const result = extractMainContent(navHeavyMarkdown);
    expect(result).toContain('Real article content goes here');
    expect(result).toContain('More substantive content about the topic.');
  });

  it('removes nav keyword links (Home, About, Contact, Login...)', () => {
    const result = extractMainContent(navHeavyMarkdown);
    expect(result).not.toContain('[Home]');
    expect(result).not.toContain('[About]');
    expect(result).not.toContain('[Contact]');
    expect(result).not.toContain('[Login]');
  });

  it('removes social media links', () => {
    const result = extractMainContent(navHeavyMarkdown);
    expect(result).not.toContain('[Twitter]');
    expect(result).not.toContain('[Facebook]');
    expect(result).not.toContain('[Instagram]');
  });

  it('removes copyright footer lines', () => {
    const result = extractMainContent(navHeavyMarkdown);
    expect(result).not.toContain('©');
    expect(result).not.toContain('All rights reserved');
  });

  it('removes sidebar section headers', () => {
    const result = extractMainContent(navHeavyMarkdown);
    expect(result).not.toContain('Related Posts');
    expect(result).not.toContain('Newsletter');
  });
});

// ─────────────────────────────────────────────
// Regression: transformPageToRecord full integration
// ─────────────────────────────────────────────

describe('Regression: transformPageToRecord integration', () => {
  const samplePage = makePage();
  const sampleAssets: CrawlAsset[] = [
    makeLinkAsset('https://example.com/related'),
    makeLinkAsset('https://external.org/ref'),
    makeImageAsset('https://cdn.example.com/banner.jpg', 'Banner'),
    makeImageAsset('https://cdn.example.com/banner.jpg', 'Banner duplicate'), // duplicate image
  ];

  const seenHashes = new Set<string>();
  let record: ReturnType<typeof transformPageToRecord>;

  beforeAll(() => {
    record = transformPageToRecord({
      page: samplePage,
      assets: sampleAssets,
      tables: [],
      jobDomain: SAMPLE_JOB_DOMAIN,
      seenContentHashes: seenHashes,
    });
  });

  it('links are not empty', () => {
    expect(record.links.length).toBeGreaterThan(0);
  });

  it('images are deduplicated (no duplicate URL)', () => {
    const urls = record.images.map((i) => i.sourceUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('mainContent does not contain nav menu items', () => {
    expect(record.mainContent).not.toContain('[Home]');
    expect(record.mainContent).not.toContain('[About]');
    expect(record.mainContent).not.toContain('[Contact]');
  });

  it('mainContent does not contain copyright footer', () => {
    expect(record.mainContent).not.toContain('©');
    expect(record.mainContent).not.toContain('All rights reserved');
  });

  it('cleanText is a plain-text version without markdown syntax', () => {
    expect(record.cleanText).not.toContain('#');
    expect(record.cleanText).not.toContain('**');
    expect(record.cleanText).not.toContain('[');
  });

  it('wordCount is positive for a page with real content', () => {
    expect(record.wordCount).toBeGreaterThan(0);
  });

  it('dataQualityScore is between 0 and 100', () => {
    expect(record.dataQualityScore).not.toBeNull();
    expect(record.dataQualityScore!).toBeGreaterThanOrEqual(0);
    expect(record.dataQualityScore!).toBeLessThanOrEqual(100);
  });

  it('warnings is an array (may be empty for quality page)', () => {
    expect(Array.isArray(record.warnings)).toBe(true);
  });

  it('contentHash is a 64-char hex string', () => {
    expect(record.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
