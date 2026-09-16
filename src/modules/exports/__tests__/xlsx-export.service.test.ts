import fs from "fs";
import { EventEmitter } from "events";
import ExcelJS from "exceljs";
import { XlsxExportService } from "../xlsx-export.service";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../../common/helpers/file.helper", () => ({
  buildJobDataFilePath: jest.fn((jobId: string, fileName: string) => ({
    fileName,
    filePath: `test/${fileName}`,
  })),
  buildJobXlsxZipPath: jest.fn((jobId: string) => ({
    fileName: "xlsx.zip",
    filePath: `test/xlsx.zip`,
  })),
  ensureJobExportStructure: jest.fn(),
  ensureDirExists: jest.fn(),
  getFileSizeBytes: jest.fn(() => 2048),
}));

let mockArchiveStream: EventEmitter;

jest.mock("archiver", () => {
  return jest.fn(() => ({
    pipe: jest.fn(),
    file: jest.fn(),
    finalize: jest.fn().mockImplementation(function (this: any) {
      if (mockArchiveStream) {
        process.nextTick(() => mockArchiveStream.emit("close"));
      }
    }),
    on: jest.fn(),
  }));
});

describe("XlsxExportService", () => {
  let service: XlsxExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new XlsxExportService();

    mockArchiveStream = new EventEmitter();
    jest.spyOn(fs, "createWriteStream").mockImplementation(() => mockArchiveStream as any);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exports pages.xlsx with Page ID, Word Count, Quality Score, and Content Preview", async () => {
    const addWorksheetSpy = jest.spyOn(ExcelJS.Workbook.prototype, "addWorksheet");
    jest.spyOn(ExcelJS.Workbook.prototype.xlsx, "writeFile").mockResolvedValue(undefined as any);

    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          url: "https://example.com/test",
          title: "Test Page",
          description: "Test Description",
          status: "COMPLETED",
          statusCode: 200,
          errorMessage: null,
          wordCount: 250,
          dataQualityScore: 95,
          markdownContent: "# Header\n\nMain content here.",
          crawledAt: new Date("2026-09-02T12:00:00Z"),
        },
      ],
    };

    await service.exportPages(mockJob);

    expect(addWorksheetSpy).toHaveBeenCalled();
    const sheet = addWorksheetSpy.mock.results[0].value as ExcelJS.Worksheet;
    expect(sheet.name).toBe("Pages");

    const columnHeaders = sheet.columns?.map((c) => c.header) ?? [];
    expect(columnHeaders).toContain("Page ID");
    expect(columnHeaders).toContain("Word Count");
    expect(columnHeaders).toContain("Quality Score");
    expect(columnHeaders).toContain("Content Preview");

    const dataRow = sheet.getRow(2).values as any[];
    expect(dataRow).toContain("page-1");
    expect(dataRow).toContain(250);
    expect(dataRow).toContain(95);
  });

  it("exports tables.xlsx with Page ID in Summary sheet", async () => {
    const addWorksheetSpy = jest.spyOn(ExcelJS.Workbook.prototype, "addWorksheet");
    jest.spyOn(ExcelJS.Workbook.prototype.xlsx, "writeFile").mockResolvedValue(undefined as any);

    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          url: "https://example.com/test",
          content: `
            <div>
              <table>
                <caption>Pricing Table</caption>
                <thead><tr><th>Item</th><th>Price</th></tr></thead>
                <tbody><tr><td>Widget</td><td>$10</td></tr></tbody>
              </table>
            </div>
          `,
          markdownContent: "",
          status: "COMPLETED",
        },
      ],
    };

    await service.exportTables(mockJob);

    expect(addWorksheetSpy).toHaveBeenCalled();
    const summarySheet = addWorksheetSpy.mock.results.find(
      (r) => r.value.name === "Summary",
    )?.value as ExcelJS.Worksheet;
    expect(summarySheet).toBeDefined();

    const columnHeaders = summarySheet.columns?.map((c) => c.header) ?? [];
    expect(columnHeaders).toContain("Page ID");
    expect(columnHeaders).toContain("Sheet Name");

    const dataRow = summarySheet.getRow(2).values as any[];
    expect(dataRow).toContain("page-1");
  });

  it("bundles pages.xlsx and tables.xlsx into xlsx.zip upon export", async () => {
    jest.spyOn(ExcelJS.Workbook.prototype.xlsx, "writeFile").mockResolvedValue(undefined as any);

    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [],
    };

    const result = await service.export(mockJob);

    expect(result.fileName).toBe("xlsx.zip");
    expect(result.filePath).toContain("xlsx.zip");
  });
});
