import fs from "fs";
import { MarkdownExportService } from "../markdown-export.service";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../../common/helpers/file.helper", () => ({
  buildJobMarkdownRawFilePath: jest.fn((_jobId: string, idx: number) => ({
    fileName: `00${idx}-raw.md`,
    filePath: `test/markdown/raw/00${idx}-raw.md`,
  })),
  buildJobMarkdownCleanFilePath: jest.fn((_jobId: string, idx: number) => ({
    fileName: `00${idx}-clean.md`,
    filePath: `test/markdown/clean/00${idx}-clean.md`,
  })),
  buildJobMarkdownZipPath: jest.fn(() => ({
    fileName: "markdown.zip",
    filePath: "test/markdown.zip",
  })),
  buildJobSubDir: jest.fn(() => "test/markdown"),
  ensureJobExportStructure: jest.fn(),
}));

jest.mock("fs");

describe("MarkdownExportService", () => {
  let service: MarkdownExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarkdownExportService();
  });

  it("writes only to raw/ and clean/ subdirectories without redundant files in root markdown/", () => {
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
          markdownContent: "# Test Header\n\nMain content here.",
        },
      ],
    };

    const results = service.writePageFiles(mockJob);

    // Exactly 2 files should be written per page: one in raw, one in clean
    expect(results).toHaveLength(2);
    expect(Object.keys(writtenFiles)).toEqual([
      "test/markdown/raw/000-raw.md",
      "test/markdown/clean/000-clean.md",
    ]);

    // Raw file contains original markdown
    expect(writtenFiles["test/markdown/raw/000-raw.md"]).toContain("# Test Header");
    // Clean file contains extracted content
    expect(writtenFiles["test/markdown/clean/000-clean.md"]).toContain("# Test Header");
  });
});
