import { CrawlJob, CrawlPage } from "@prisma/client";
import { ExportService } from "../export.service";
import { JsonExportService } from "../json-export.service";

describe("ExportService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the completed export record after updating its status", async () => {
    const job = { id: "job-1" } as CrawlJob;
    const fullJob = { ...job, pages: [] } as CrawlJob & {
      pages: CrawlPage[];
    };
    const pendingRecord = {
      id: "export-1",
      jobId: job.id,
      exportType: "JSON",
      status: "PENDING",
      fileName: "pages.json",
      filePath: "job-1/data/pages.json",
      fileSize: 12,
      mimeType: "application/json",
    };
    const completedRecord = { ...pendingRecord, status: "COMPLETED" };
    const create = jest.fn().mockResolvedValue(pendingRecord);
    const update = jest.fn().mockResolvedValue(completedRecord);

    jest.spyOn(JsonExportService.prototype, "export").mockResolvedValue({
      fileName: pendingRecord.fileName,
      filePath: pendingRecord.filePath,
      fileSize: pendingRecord.fileSize,
      mimeType: pendingRecord.mimeType,
    });

    const service = new ExportService() as unknown as {
      crawlJobRepository: {
        findByIdWithPages: jest.Mock;
      };
      exportRepository: {
        create: jest.Mock;
        update: jest.Mock;
      };
      generate: ExportService["generate"];
    };
    service.crawlJobRepository = {
      findByIdWithPages: jest.fn().mockResolvedValue(fullJob),
    };
    service.exportRepository = { create, update };

    const result = await service.generate(job, "JSON");

    expect(update).toHaveBeenCalledWith(pendingRecord.id, {
      status: "COMPLETED",
    });
    expect(result).toEqual(completedRecord);
  });
});
