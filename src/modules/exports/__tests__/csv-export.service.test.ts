import fs from "fs";
import { CsvExportService } from "../csv-export.service";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../crawl-assets/crawl-asset.repository", () => ({
  CrawlAssetRepository: jest.fn().mockImplementation(() => ({
    findByJobId: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../../../common/helpers/file.helper", () => ({
  buildJobDataFilePath: jest.fn((jobId: string, fileName: string) => ({
    fileName,
    filePath: `test/${fileName}`,
  })),
  ensureJobExportStructure: jest.fn(),
}));

jest.mock("fs");

describe("CsvExportService", () => {
  let service: CsvExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CsvExportService();
  });

  it("neutralizes formula injection characters (=, +, -, @) in CSV export", async () => {
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
          markdownContent: "+12345",
          crawledAt: new Date("2026-09-02T12:00:00Z"),
        },
      ],
    };

    await (service as any).executeExport(mockJob);

    const pagesCsv = writtenFiles["test/pages.csv"];
    expect(pagesCsv).toBeDefined();
    expect(pagesCsv).toContain("'=cmd|'/C calc'!A0");
    expect(pagesCsv).toContain("'@SUM(1,2)");
    expect(pagesCsv).toContain("'+12345");
  });
});
