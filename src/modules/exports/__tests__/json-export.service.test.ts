import fs from "fs";
import { EventEmitter } from "events";
import { JsonExportService } from "../json-export.service";
import { JOB_EXPORT_FILES } from "../../../common/constants/storage-path.constant";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../crawl-assets/crawl-asset.repository", () => ({
  CrawlAssetRepository: jest.fn().mockImplementation(() => ({
    findAssetsForJsonExport: jest.fn().mockResolvedValue([
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
    filePath: `test/data/${fileName}`,
  })),
  buildJobDataRawFilePath: jest.fn((jobId: string, fileName: string) => ({
    fileName,
    filePath: `test/data/raw/${fileName}`,
  })),
  buildJobDataCleanFilePath: jest.fn((jobId: string, fileName: string) => ({
    fileName,
    filePath: `test/data/clean/${fileName}`,
  })),
  buildJobJsonZipPath: jest.fn((jobId: string) => ({
    fileName: "json.zip",
    filePath: `test/json.zip`,
  })),
  ensureJobExportStructure: jest.fn(),
  ensureDirExists: jest.fn(),
  getFileSizeBytes: jest.fn(() => 1024),
}));

let mockArchiveStream: EventEmitter;
let archivedFiles: { path: string; name: string }[] = [];

jest.mock("archiver", () => {
  return jest.fn(() => ({
    pipe: jest.fn(),
    file: jest.fn((sourcePath: string, data: { name: string }) => {
      archivedFiles.push({ path: sourcePath, name: data.name });
    }),
    finalize: jest.fn().mockImplementation(function (this: any) {
      if (mockArchiveStream) {
        process.nextTick(() => mockArchiveStream.emit("close"));
      }
    }),
    on: jest.fn(),
  }));
});

describe("JsonExportService", () => {
  let service: JsonExportService;
  let writtenFiles: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    writtenFiles = {};
    archivedFiles = [];
    service = new JsonExportService();

    mockArchiveStream = new EventEmitter();
    jest.spyOn(fs, "createWriteStream").mockImplementation(() => mockArchiveStream as any);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "writeFileSync").mockImplementation((filePath, data) => {
      writtenFiles[filePath.toString()] = data.toString();
    });
  });

  it("exports pages.json, clean/pages.clean.json, raw/pages.raw.json and bundles into json.zip", async () => {
    const mockJob: any = {
      id: "job-1",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          jobId: "job-1",
          url: "https://example.com/test",
          content: "<div>Content with <table><tr><td>Item</td></tr></table></div>",
          markdownContent: "# Title\n\nMain content for test.\n\n[Link](https://example.com/sub)",
          title: "Test Page",
          description: "Test Description",
          status: "SUCCESS",
          statusCode: 200,
          crawledAt: new Date("2026-07-21T10:00:00.000Z"),
          structuredData: null,
        },
      ],
    };

    const result = await service.export(mockJob);

    expect(result.fileName).toBe("json.zip");
    expect(result.filePath).toMatch(/test[\\/]json\.zip$/);

    // 1. Kiểm tra pages.json
    const pagesJsonContent = JSON.parse(writtenFiles[`test/data/${JOB_EXPORT_FILES.PAGES_JSON}`]);
    expect(pagesJsonContent.jobId).toBe("job-1");
    expect(pagesJsonContent.schemaVersion).toBeDefined();
    expect(pagesJsonContent.totalRecords).toBe(1);
    expect(pagesJsonContent.pages[0].id).toBe("page-1");
    expect(pagesJsonContent.pages[0].rawMarkdown).toBeDefined();
    expect(pagesJsonContent.pages[0].cleanText).toBeDefined();
    expect(pagesJsonContent.pages[0].mainContent).toBeDefined();

    // 2. Kiểm tra pages.clean.json: không có rawMarkdown
    const cleanJsonContent = JSON.parse(writtenFiles[`test/data/clean/${JOB_EXPORT_FILES.PAGES_CLEAN_JSON}`]);
    expect(cleanJsonContent.pages[0].rawMarkdown).toBeUndefined();
    expect(cleanJsonContent.pages[0].mainContent).toBeDefined();
    expect(cleanJsonContent.pages[0].cleanText).toBeDefined();
    expect(cleanJsonContent.pages[0].dataQualityScore).toBeDefined();

    // 3. Kiểm tra pages.raw.json: không có cleanText và dataQualityScore
    const rawJsonContent = JSON.parse(writtenFiles[`test/data/raw/${JOB_EXPORT_FILES.PAGES_RAW_JSON}`]);
    expect(rawJsonContent.pages[0].rawMarkdown).toBeDefined();
    expect(rawJsonContent.pages[0].cleanText).toBeUndefined();
    expect(rawJsonContent.pages[0].dataQualityScore).toBeUndefined();

    // 4. Kiểm tra các file được đưa vào zip
    const archivedNames = archivedFiles.map((f) => f.name);
    expect(archivedNames).toContain("pages.json");
    expect(archivedNames).toContain("clean/pages.clean.json");
    expect(archivedNames).toContain("raw/pages.raw.json");
  });

  it("writes structured.json and packs it when pages have structuredData", async () => {
    const mockJob: any = {
      id: "job-2",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          jobId: "job-2",
          url: "https://example.com/item",
          content: "<div>Content</div>",
          markdownContent: "Content",
          status: "SUCCESS",
          statusCode: 200,
          structuredData: { "@type": "Product", name: "Widget" },
        },
      ],
    };

    await service.export(mockJob);

    const structuredJsonPath = `test/data/${JOB_EXPORT_FILES.STRUCTURED_JSON}`;
    expect(writtenFiles[structuredJsonPath]).toBeDefined();
    const structuredContent = JSON.parse(writtenFiles[structuredJsonPath]);
    expect(structuredContent.records).toHaveLength(1);
    expect(structuredContent.records[0].structuredData).toEqual({ "@type": "Product", name: "Widget" });

    const archivedNames = archivedFiles.map((f) => f.name);
    expect(archivedNames).toContain("structured.json");
  });

  it("does not write structured.json when no pages have structuredData", async () => {
    const mockJob: any = {
      id: "job-3",
      startUrl: "https://example.com",
      domain: "example.com",
      pages: [
        {
          id: "page-1",
          jobId: "job-3",
          url: "https://example.com/no-data",
          content: "<div>Content</div>",
          markdownContent: "Content",
          status: "SUCCESS",
          statusCode: 200,
          structuredData: null,
        },
      ],
    };

    // Khi structured.json không tồn tại, existsSync trả về false
    jest.spyOn(fs, "existsSync").mockImplementation((p: any) => {
      if (p.toString().includes("structured.json")) return false;
      return true;
    });

    await service.export(mockJob);

    const structuredJsonPath = `test/data/${JOB_EXPORT_FILES.STRUCTURED_JSON}`;
    expect(writtenFiles[structuredJsonPath]).toBeUndefined();

    const archivedNames = archivedFiles.map((f) => f.name);
    expect(archivedNames).not.toContain("structured.json");
  });
});
