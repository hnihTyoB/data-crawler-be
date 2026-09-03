import * as cheerio from "cheerio";
import { ExtractionFieldDto } from "../extraction-templates/extraction-template.dto";

export interface ExtractionResult {
  success: boolean;
  data: Record<string, string | null>;
  missingRequired: string[];
}

/**
 * Runs CSS selector extraction against raw HTML using a template's field definitions.
 *
 * For each field:
 *   - selector: CSS selector to find the element
 *   - attr: attribute to extract. Use "innerText" for text content.
 *   - required: if true and no value found, the field is added to missingRequired
 *
 * Returns success=false if any required field yields no value.
 */
export function runExtraction(
  html: string,
  fields: ExtractionFieldDto[],
): ExtractionResult {
  const $ = cheerio.load(html);
  const data: Record<string, string | null> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const el = $(field.selector).first();

    let value: string | null = null;
    if (el.length > 0) {
      if (field.attr === "innerText") {
        value = el.text().trim() || null;
      } else {
        value = el.attr(field.attr)?.trim() ?? null;
      }
    }

    data[field.name] = value;

    if (field.required && (value === null || value === "")) {
      missingRequired.push(field.name);
    }
  }

  return {
    success: missingRequired.length === 0,
    data,
    missingRequired,
  };
}
