import fs from "fs";
import { EventEmitter } from "events";
import { CsvExportService } from "../csv-export.service";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../crawl-assets/crawl-asset.repository", () => ({
  CrawlAssetRepository: jest.fn().mockImplementation(() => ({
    findByJobId: jest.fn().mockResolvedValue([
      {
        id: "asset-1",
        pageId: "page-1",
        assetType: "LINK",
        url: "https://example.com/sub",
        sourceUrl: "https://example.com/test",
      },
      {
        id: "asset-2",
        pageId: "page-1",
        assetType: "IMAGE",
        url: "https://example.com/image.png",
        altText: "Test Image",
        mimeType: "image/png",
        orderIndex: 1,
      },
    ]),
  })),
}));

jest.mock("../../../common/helpers/file.helper", () => ({
  buildJobDataFilePath: jest.fn((jobId: string, fileName: string) => ({
    fileName,
    filePath: `test/${fileName}`,
  })),
  buildJobCsvZipPath: jest.fn((jobId: string) => ({
    fileName: "csv.zip",
    filePath: `test/csv.zip`,
  })),
  ensureJobExportStructure: jest.fn(),
  ensureDirExists: jest.fn(),
  getFileSizeBytes: jest.fn(() => 1024),
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

jest.mock("fs");

describe("CsvExportService", () => {
  let service: CsvExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CsvExportService();

    mockArchiveStream = new EventEmitter();
    (fs.createWriteStream as jest.Mock).mockImplementation(() => mockArchiveStream);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it("neutralizes formula injection characters (=, +, -, @) and includes pageId in pages.csv", async () => {
    const writtenFiles: Record<string, string> = {};
    (fs.writeFileSync as jest.Mock).mockImplementation((filePath, content) => {
      writtenFiles[filePath] = content;
    });

    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          url: "https://example.com/test",
          title: "=cmd|'/C calc'!A0",
          description: "@SUM(1,2)",
          status: "COMPLETED",
          statusCode: 200,
          errorMessage: null,
          wordCount: 150,
          dataQualityScore: 90,
          markdownContent: "+12345",
          crawledAt: new Date("2026-09-02T12:00:00Z"),
        },
      ],
    };

    await service.exportPages(mockJob);

    const pagesCsv = writtenFiles["test/pages.csv"];
    expect(pagesCsv).toBeDefined();

    // Verify headers
    const headerLine = pagesCsv.split("\n")[0];
    expect(headerLine).toBe(
      "pageId,url,title,description,status,statusCode,errorMessage,wordCount,dataQualityScore,mainContent,crawledAt",
    );

    // Verify content & formula neutralization
    expect(pagesCsv).toContain("page-1");
    expect(pagesCsv).toContain("'=cmd|'/C calc'!A0");
    expect(pagesCsv).toContain("'@SUM(1,2)");
    expect(pagesCsv).toContain("'+12345");
  });

  it("exports pages.csv, links.csv, images.csv and bundles them into csv.zip", async () => {
    const writtenFiles: Record<string, string> = {};
    (fs.writeFileSync as jest.Mock).mockImplementation((filePath, content) => {
      writtenFiles[filePath] = content;
    });

    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          url: "https://example.com/test",
          title: "Test Page",
          description: "Description",
          status: "COMPLETED",
          statusCode: 200,
          errorMessage: null,
          wordCount: 100,
          dataQualityScore: 85,
          markdownContent: "Hello world",
          crawledAt: new Date("2026-09-02T12:00:00Z"),
        },
      ],
    };

    const result = await service.export(mockJob);

    expect(writtenFiles["test/pages.csv"]).toBeDefined();
    expect(writtenFiles["test/links.csv"]).toBeDefined();
    expect(writtenFiles["test/images.csv"]).toBeDefined();

    expect(result.fileName).toBe("csv.zip");
    expect(result.filePath).toContain("csv.zip");
  });
});
