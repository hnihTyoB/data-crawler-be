import * as cheerio from 'cheerio';
import { ExtractionTemplateRepository } from './extraction-template.repository';
import { ExtractionFieldDto } from './extraction-template.dto';
import { CrawlPageRepository } from '../crawl-pages/crawl-page.repository';
import { FirecrawlPageResult } from '../firecrawl/firecrawl.dto';

const getTemplateRepository = () => new ExtractionTemplateRepository();
const getPageRepository = () => new CrawlPageRepository();

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function runSelectors(
  html: string,
  fields: ExtractionFieldDto[],
): { success: boolean; data: Record<string, string | null>; missingRequired: string[] } {
  const $ = cheerio.load(html);
  const data: Record<string, string | null> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const el = $(field.selector).first();
    let value: string | null = null;
    if (el.length > 0) {
      value = field.attr === 'innerText'
        ? (el.text().trim() || null)
        : (el.attr(field.attr)?.trim() ?? null);
    }
    data[field.name] = value;
    if (field.required && !value) missingRequired.push(field.name);
  }

  return { success: missingRequired.length === 0, data, missingRequired };
}

/**
 * Checks if an ExtractionTemplate exists for the page's domain.
 * If found, runs CSS selector extraction against the page's raw HTML.
 * Saves result to CrawlPage.structuredData — includes success flag and
 * missingRequired list so consumers know if required fields were absent.
 * Fails loudly: missingRequired fields are recorded in the result,
 * and success=false signals to downstream consumers that the extraction
 * did not fully satisfy the template.
 * No-ops silently if no template exists for the domain or page has no HTML.
 */
export async function runExtractionIfTemplate(
  jobId: string,
  pageId: string,
  pageUrl: string,
  item: FirecrawlPageResult,
): Promise<void> {
  // Extraction requires raw HTML — Firecrawl returns it via the html field
  // which is not currently surfaced in FirecrawlPageResult. We fall back to
  // markdownContent if html is unavailable. A future task should add html
  // to FirecrawlPageResult and pass it through normalizePage().
  const html = (item as any).html ?? item.markdown ?? '';
  if (!html) return;

  const domain = extractDomainFromUrl(pageUrl);
  if (!domain) return;

  const template = await getTemplateRepository().findByDomain(domain);
  if (!template) return;

  const fields = template.fields as unknown as ExtractionFieldDto[];
  if (!fields || fields.length === 0) return;

  const result = runSelectors(html, fields);

  await getPageRepository().update(pageId, {
    structuredData: {
      templateId: template.id,
      templateName: template.name,
      success: result.success,
      missingRequired: result.missingRequired,
      data: result.data,
      extractedAt: new Date().toISOString(),
    },
  } as any);
}