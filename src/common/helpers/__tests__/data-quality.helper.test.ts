import {
  calcDataQualityScore,
  detectWarnings,
  normalizeUrl,
  stripMarkdown,
  extractMainContent,
  countWords,
  hashContent,
} from '../data-contract.helper';

// ─────────────────────────────────────────────
// calcDataQualityScore
// ─────────────────────────────────────────────
describe('calcDataQualityScore', () => {
  const baseParams = {
    isSuccess: true,
    mainContent: 'Some main content here',
    wordCount: 150,
    title: 'Article Title',
    description: 'Article description',
  };

  it('returns 100 when all criteria are met', () => {
    expect(calcDataQualityScore(baseParams)).toBe(100);
  });

  it('returns null for failed pages (not success)', () => {
    expect(calcDataQualityScore({ ...baseParams, isSuccess: false })).toBeNull();
  });

  it('deducts 40 when mainContent is missing', () => {
    expect(calcDataQualityScore({ ...baseParams, mainContent: null })).toBe(60);
  });

  it('deducts 30 when wordCount is below threshold (50)', () => {
    expect(calcDataQualityScore({ ...baseParams, wordCount: 30 })).toBe(70);
  });

  it('deducts 15 when title is missing', () => {
    expect(calcDataQualityScore({ ...baseParams, title: null })).toBe(85);
  });

  it('deducts 15 when description is missing', () => {
    expect(calcDataQualityScore({ ...baseParams, description: null })).toBe(85);
  });

  it('returns 0 for a page with no content, no title, no description and low wordCount', () => {
    expect(calcDataQualityScore({
      isSuccess: true,
      mainContent: null,
      wordCount: 0,
      title: null,
      description: null,
    })).toBe(0);
  });
});

// ─────────────────────────────────────────────
// detectWarnings
// ─────────────────────────────────────────────
describe('detectWarnings', () => {
  const cleanPage = {
    title: 'Article Title',
    description: 'Good description',
    wordCount: 200,
    dataQualityScore: 100,
    isDuplicateContent: false,
    isNavNoise: false,
  };

  it('returns empty array for a fully valid page', () => {
    expect(detectWarnings(cleanPage)).toEqual([]);
  });

  it('adds MISSING_TITLE when title is null', () => {
    expect(detectWarnings({ ...cleanPage, title: null })).toContain('MISSING_TITLE');
  });

  it('adds MISSING_DESCRIPTION when description is null', () => {
    expect(detectWarnings({ ...cleanPage, description: null })).toContain('MISSING_DESCRIPTION');
  });

  it('adds TOO_SHORT when wordCount < 100 and > 0', () => {
    expect(detectWarnings({ ...cleanPage, wordCount: 30 })).toContain('TOO_SHORT');
  });

  it('does NOT add TOO_SHORT when wordCount is 0 (empty page — different case)', () => {
    expect(detectWarnings({ ...cleanPage, wordCount: 0 })).not.toContain('TOO_SHORT');
  });

  it('adds DUPLICATE_CONTENT when isDuplicateContent is true', () => {
    expect(detectWarnings({ ...cleanPage, isDuplicateContent: true })).toContain('DUPLICATE_CONTENT');
  });

  it('adds NAV_NOISE when isNavNoise is true', () => {
    expect(detectWarnings({ ...cleanPage, isNavNoise: true })).toContain('NAV_NOISE');
  });

  it('adds LOW_QUALITY_SCORE when dataQualityScore is below threshold (30)', () => {
    expect(detectWarnings({ ...cleanPage, dataQualityScore: 20 })).toContain('LOW_QUALITY_SCORE');
  });

  it('does NOT add LOW_QUALITY_SCORE when dataQualityScore is null (failed page)', () => {
    expect(detectWarnings({ ...cleanPage, dataQualityScore: null })).not.toContain('LOW_QUALITY_SCORE');
  });

  it('accumulates multiple warnings at once', () => {
    const warnings = detectWarnings({
      title: null,
      description: null,
      wordCount: 10,
      dataQualityScore: 0,
      isDuplicateContent: true,
      isNavNoise: true,
    });
    expect(warnings).toContain('MISSING_TITLE');
    expect(warnings).toContain('MISSING_DESCRIPTION');
    expect(warnings).toContain('TOO_SHORT');
    expect(warnings).toContain('DUPLICATE_CONTENT');
    expect(warnings).toContain('NAV_NOISE');
    expect(warnings).toContain('LOW_QUALITY_SCORE');
    expect(warnings).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────
// normalizeUrl
// ─────────────────────────────────────────────
describe('normalizeUrl', () => {
  it('lowercases scheme and hostname', () => {
    expect(normalizeUrl('HTTPS://Example.COM/path')).toBe('https://example.com/path');
  });

  it('removes fragment (#...)', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('removes trailing slash from pathname (not root)', () => {
    expect(normalizeUrl('https://example.com/article/')).toBe('https://example.com/article');
  });

  it('keeps root slash as-is', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('sorts query params alphabetically', () => {
    expect(normalizeUrl('https://example.com/?z=3&a=1&m=2')).toBe('https://example.com/?a=1&m=2&z=3');
  });

  it('strips known UTM tracking params', () => {
    const url = 'https://example.com/article?utm_source=google&utm_medium=cpc&id=123';
    expect(normalizeUrl(url)).toBe('https://example.com/article?id=123');
  });

  it('strips fbclid and gclid tracking params', () => {
    expect(normalizeUrl('https://example.com/?fbclid=abc&page=1')).toBe('https://example.com/?page=1');
    expect(normalizeUrl('https://example.com/?gclid=xyz&q=2')).toBe('https://example.com/?q=2');
  });

  it('returns raw URL unchanged for invalid URLs', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

// ─────────────────────────────────────────────
// stripMarkdown
// ─────────────────────────────────────────────
describe('stripMarkdown', () => {
  it('removes headings', () => {
    expect(stripMarkdown('# Title\n## Section')).not.toContain('#');
  });

  it('removes bold and italic', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
  });

  it('removes inline code', () => {
    expect(stripMarkdown('Use `console.log()` here')).toBe('Use  here');
  });

  it('removes code blocks', () => {
    expect(stripMarkdown('```\ncode\n```')).toBe('');
  });

  it('converts links to link text only', () => {
    expect(stripMarkdown('[Click here](https://example.com)')).toBe('Click here');
  });

  it('removes images', () => {
    expect(stripMarkdown('![alt](https://example.com/img.png)')).toBe('');
  });

  it('removes blockquotes', () => {
    expect(stripMarkdown('> Quote content')).toBe('Quote content');
  });
});

// ─────────────────────────────────────────────
// extractMainContent
// ─────────────────────────────────────────────
describe('extractMainContent', () => {
  it('returns empty string for null/undefined input', () => {
    expect(extractMainContent(null)).toBe('');
    expect(extractMainContent(undefined)).toBe('');
  });

  it('removes navigation links with known nav keywords', () => {
    const input = '# Article\n\nContent here\n\n* [Home](/)\n* [About](/about)';
    const result = extractMainContent(input);
    expect(result).toContain('Content here');
    expect(result).not.toContain('[Home]');
    expect(result).not.toContain('[About]');
  });

  it('removes copyright lines', () => {
    const input = 'Good article content\n\n© 2024 Company. All rights reserved.';
    const result = extractMainContent(input);
    expect(result).toContain('Good article content');
    expect(result).not.toContain('All rights reserved');
  });

  it('keeps non-nav list items', () => {
    const input = '* [React](https://react.dev) — thư viện UI\n* [Node.js](https://nodejs.org) — runtime';
    const result = extractMainContent(input);
    expect(result).toContain('React');
  });
});

// ─────────────────────────────────────────────
// countWords
// ─────────────────────────────────────────────
describe('countWords', () => {
  it('counts words correctly', () => {
    expect(countWords('hello world foo')).toBe(3);
  });

  it('ignores extra whitespace and newlines', () => {
    expect(countWords('  hello   world\n\nfoo  ')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \n\n  ')).toBe(0);
  });
});

// ─────────────────────────────────────────────
// hashContent
// ─────────────────────────────────────────────
describe('hashContent', () => {
  it('returns a 64-char hex SHA-256 string for non-empty text', () => {
    const hash = hashContent('hello world');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('returns null for empty string', () => {
    expect(hashContent('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(hashContent('   ')).toBeNull();
  });

  it('produces the same hash for identical content (deterministic)', () => {
    expect(hashContent('same content')).toBe(hashContent('same content'));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('content A')).not.toBe(hashContent('content B'));
  });
});
