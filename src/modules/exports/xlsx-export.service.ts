import ExcelJS from 'exceljs';
import { parse as parseHtml } from 'node-html-parser';
import { CrawlJob, CrawlPage } from '@prisma/client';
import { JOB_EXPORT_FILES } from '../../common/constants/storage-path.constant';
import { EXPORT_MIME_TYPES } from '../../common/constants/export-type.constant';
import { buildJobDataFilePath } from '../../common/helpers/file.helper';
import { BaseExportService } from './base-export.service';
import { extractMainContent, stripMarkdown } from '../../common/helpers/data-contract.helper';

interface ParsedTable {
  pageUrl: string;
  tableIndex: number;
  headers: string[];
  rows: string[][];
  caption: string;
}

export class XlsxExportService extends BaseExportService {
  readonly mimeType = EXPORT_MIME_TYPES.XLSX;

  protected async executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    const pagesResult = await this.exportPages(job);
    await this.exportTables(job);
    return pagesResult;
  }

  /**
   * Xuất pages.xlsx — Sheet "Pages" tổng hợp metadata của tất cả các trang.
   * Nếu phát hiện có HTML tables trong nội dung các trang, tự động gộp thêm
   * sheet "Tables Summary" và chi tiết từng bảng vào cùng file Excel này.
   */
  async exportPages(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.PAGES_XLSX,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Pages');

    sheet.columns = [
      { header: 'URL', key: 'url', width: 55 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Description', key: 'description', width: 55 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Status Code', key: 'statusCode', width: 14 },
      { header: 'Raw Markdown', key: 'rawMarkdown', width: 60 },
      { header: 'Clean Text', key: 'cleanText', width: 60 },
      { header: 'Main Content', key: 'mainContent', width: 60 },
      { header: 'Error', key: 'errorMessage', width: 40 },
      { header: 'Crawled At', key: 'crawledAt', width: 25 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    for (const page of job.pages) {
      const rawMarkdown = page.markdownContent ?? '';
      const mainContent = extractMainContent(rawMarkdown);
      const cleanText = mainContent ? stripMarkdown(mainContent) : '';

      const row = sheet.addRow({
        url: page.url,
        title: page.title ?? '',
        description: page.description ?? '',
        status: page.status,
        statusCode: page.statusCode ?? '',
        rawMarkdown: rawMarkdown.slice(0, 500),
        cleanText: cleanText.slice(0, 500),
        mainContent: mainContent.slice(0, 500),
        errorMessage: page.errorMessage ?? '',
        crawledAt: page.crawledAt?.toISOString() ?? '',
      });

      // Color failed rows
      if (page.status === 'FAILED') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
        row.getCell('status').font = { color: { argb: 'FFB91C1C' } };
      }
    }

    sheet.autoFilter = {
      from: 'A1',
      to: `J${job.pages.length + 1}`,
    };

    // --- Tích hợp thêm HTML tables nếu có ---
    const allTables = this.extractAllHtmlTables(job.pages);
    if (allTables.length > 0) {
      // Sheet Summary cho các Table
      const summarySheet = workbook.addWorksheet('Tables Summary');
      summarySheet.columns = [
        { header: 'Sheet Name', key: 'sheet', width: 22 },
        { header: 'Page URL', key: 'url', width: 60 },
        { header: 'Table #', key: 'index', width: 10 },
        { header: 'Rows', key: 'rows', width: 10 },
        { header: 'Columns', key: 'cols', width: 10 },
        { header: 'Caption', key: 'caption', width: 30 },
      ];

      const summaryHeader = summarySheet.getRow(1);
      summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summaryHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' },
      };
      summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };
      summaryHeader.height = 22;

      // Thêm các sheet chi tiết cho từng table
      for (const table of allTables) {
        const sheetName = `Table-P${table.pageUrl
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/[^a-zA-Z0-9]/g, '-')
          .slice(0, 15)
          .replace(/-+$/, '')}-${table.tableIndex + 1}`.slice(0, 31);

        const tableSheet = workbook.addWorksheet(sheetName);

        // Ghi URL nguồn
        tableSheet.getCell('A1').value = `Source: ${table.pageUrl}`;
        tableSheet.getCell('A1').font = { italic: true, color: { argb: 'FF6B7280' } };
        tableSheet.mergeCells(1, 1, 1, Math.max(table.headers.length, 1));

        // Back to summary link
        tableSheet.getCell('A2').value = {
          text: '← Back to Tables Summary',
          hyperlink: `#'Tables Summary'!A1`,
        };
        tableSheet.getCell('A2').font = { color: { argb: 'FF2563EB' }, underline: true };
        tableSheet.mergeCells(2, 1, 2, Math.max(table.headers.length, 1));

        // Caption row (nếu có)
        let headerRowIndex = 3;
        if (table.caption) {
          tableSheet.getCell('A3').value = `Caption: ${table.caption}`;
          tableSheet.getCell('A3').font = { bold: true };
          tableSheet.mergeCells(3, 1, 3, Math.max(table.headers.length, 1));
          headerRowIndex = 4;
        }

        // Header row
        if (table.headers.length > 0) {
          const tableHeaderRow = tableSheet.getRow(headerRowIndex);
          table.headers.forEach((h, i) => {
            tableHeaderRow.getCell(i + 1).value = h;
          });
          tableHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          tableHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F766E' },
          };
          tableHeaderRow.height = 20;
          headerRowIndex++;
        }

        // Data rows
        for (const dataRow of table.rows) {
          const row = tableSheet.getRow(headerRowIndex);
          dataRow.forEach((cell, i) => {
            row.getCell(i + 1).value = cell;
          });
          headerRowIndex++;
        }

        this.autoFitColumns(tableSheet);
        this.applyTableStyles(tableSheet);

        // Ghi vào summary
        const summaryRow = summarySheet.addRow({
          sheet: {
            text: sheetName,
            hyperlink: `#'${sheetName}'!A1`,
          },
          url: table.pageUrl,
          index: table.tableIndex + 1,
          rows: table.rows.length,
          cols: table.headers.length || (table.rows[0]?.length ?? 0),
          caption: table.caption || '',
        });

        summaryRow.getCell('sheet').font = { color: { argb: 'FF2563EB' }, underline: true };
      }

      this.autoFitColumns(summarySheet);
      this.applyTableStyles(summarySheet);
    }

    await workbook.xlsx.writeFile(filePath);
    return { fileName, filePath };
  }

  async exportTables(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.TABLES_XLSX,
    );

    const allTables = this.extractAllHtmlTables(job.pages);

    const workbook = new ExcelJS.Workbook();

    // --- Sheet Summary ---
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Sheet Name', key: 'sheet', width: 22 },
      { header: 'Page URL', key: 'url', width: 60 },
      { header: 'Table #', key: 'index', width: 10 },
      { header: 'Rows', key: 'rows', width: 10 },
      { header: 'Columns', key: 'cols', width: 10 },
      { header: 'Caption', key: 'caption', width: 30 },
    ];

    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };
    summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    summaryHeader.height = 22;

    if (allTables.length === 0) {
      summarySheet.addRow({
        sheet: '—',
        url: 'Không tìm thấy HTML table nào trong các trang đã crawl.',
        index: '',
        rows: '',
        cols: '',
        caption: '',
      });
    } else {
      // --- Một sheet cho mỗi HTML table ---
      for (const table of allTables) {
        const sheetName = `Table-P${table.pageUrl
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/[^a-zA-Z0-9]/g, '-')
          .slice(0, 15)
          .replace(/-+$/, '')}-${table.tableIndex + 1}`.slice(0, 31);

        const tableSheet = workbook.addWorksheet(sheetName);

        // Ghi URL nguồn vào dòng đầu
        tableSheet.getCell('A1').value = `Source: ${table.pageUrl}`;
        tableSheet.getCell('A1').font = { italic: true, color: { argb: 'FF6B7280' } };
        tableSheet.mergeCells(1, 1, 1, Math.max(table.headers.length, 1));

        // Back to summary link
        tableSheet.getCell('A2').value = {
          text: '← Back to Summary',
          hyperlink: `#'Summary'!A1`,
        };
        tableSheet.getCell('A2').font = { color: { argb: 'FF2563EB' }, underline: true };
        tableSheet.mergeCells(2, 1, 2, Math.max(table.headers.length, 1));

        // Caption row (nếu có)
        let headerRowIndex = 3;
        if (table.caption) {
          tableSheet.getCell('A3').value = `Caption: ${table.caption}`;
          tableSheet.getCell('A3').font = { bold: true };
          tableSheet.mergeCells(3, 1, 3, Math.max(table.headers.length, 1));
          headerRowIndex = 4;
        }

        // Header row
        if (table.headers.length > 0) {
          const headerRow = tableSheet.getRow(headerRowIndex);
          table.headers.forEach((h, i) => {
            headerRow.getCell(i + 1).value = h;
          });
          headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F766E' },
          };
          headerRow.height = 20;
          headerRowIndex++;
        }

        // Data rows
        for (const dataRow of table.rows) {
          const row = tableSheet.getRow(headerRowIndex);
          dataRow.forEach((cell, i) => {
            row.getCell(i + 1).value = cell;
          });
          headerRowIndex++;
        }

        this.autoFitColumns(tableSheet);
        this.applyTableStyles(tableSheet);

        // Ghi vào Summary
        const summaryRow = summarySheet.addRow({
          sheet: {
            text: sheetName,
            hyperlink: `#'${sheetName}'!A1`,
          },
          url: table.pageUrl,
          index: table.tableIndex + 1,
          rows: table.rows.length,
          cols: table.headers.length || (table.rows[0]?.length ?? 0),
          caption: table.caption || '',
        });

        summaryRow.getCell('sheet').font = { color: { argb: 'FF2563EB' }, underline: true };
      }
    }

    this.autoFitColumns(summarySheet);
    this.applyTableStyles(summarySheet);

    await workbook.xlsx.writeFile(filePath);
    return { fileName, filePath };
  }

  /**
   * Parse tất cả HTML tables từ trường content hoặc markdownContent của các trang
   */
  private extractAllHtmlTables(pages: CrawlPage[]): ParsedTable[] {
    const result: ParsedTable[] = [];

    for (const page of pages) {
      const rawHtml = page.content ?? page.markdownContent ?? '';
      if (!rawHtml.includes('<table')) continue;

      const root = parseHtml(rawHtml);
      const tables = root.querySelectorAll('table');

      tables.forEach((table, tableIndex) => {
        const headers: string[] = [];
        const rows: string[][] = [];

        const captionEl = table.querySelector('caption');
        const caption = captionEl ? captionEl.text.trim() : '';

        // Lấy headers từ <thead> hoặc hàng <th> đầu tiên
        const thCells = table.querySelectorAll('thead th, tr:first-child th');
        if (thCells.length > 0) {
          thCells.forEach((th) => headers.push(th.text.trim()));
        }

        // Lấy các data rows từ <tbody> hoặc tất cả <tr> bỏ hàng header
        const trList = table.querySelectorAll('tbody tr, tr');
        trList.forEach((tr) => {
          const cells = tr.querySelectorAll('td');
          if (cells.length === 0) return; // bỏ qua header row
          rows.push(cells.map((td) => td.text.trim()));
        });

        if (headers.length > 0 || rows.length > 0) {
          result.push({ pageUrl: page.url, tableIndex, headers, rows, caption });
        }
      });
    }

    return result;
  }

  private autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12) {
    worksheet.columns.forEach((column) => {
      let maxLen = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        if (value) {
          let str = '';
          if (typeof value === 'object' && value !== null) {
            str = ('text' in value && typeof (value as { text: unknown }).text === 'string')
              ? (value as { text: string }).text
              : JSON.stringify(value);
          } else {
            str = String(value);
          }
          if (str.length > maxLen) {
            maxLen = str.length;
          }
        }
      });
      column.width = Math.max(maxLen + 3, minWidth);
    });
  }

  private applyTableStyles(worksheet: ExcelJS.Worksheet) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });
  }
}