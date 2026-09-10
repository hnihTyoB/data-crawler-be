import { CrawlJob, CrawlPage } from "../../common/types/database.types";
import { CrawlJobRepository } from "../crawl-jobs/crawl-job.repository";
import { CrawlExportRepository } from "../crawl-exports/crawl-export.repository";
import { JsonExportService } from "./json-export.service";
import { CsvExportService } from "./csv-export.service";
import { XlsxExportService } from "./xlsx-export.service";
import { MarkdownExportService } from "./markdown-export.service";
import { ZipExportService } from "./zip-export.service";
import { IExportService } from "./base-export.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  EXPORT_TYPE,
  ExportType,
} from "../../common/constants/export-type.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { DEFAULT_EXPORT_RETENTION_DAYS } from "../../common/constants/cron.constant";
import { systemConfigService } from "../system-config/system-config.service";

const EXPORT_SERVICES: Record<ExportType, new () => IExportService> = {
  [EXPORT_TYPE.JSON]: JsonExportService,
  [EXPORT_TYPE.CSV]: CsvExportService,
  [EXPORT_TYPE.XLSX]: XlsxExportService,
  [EXPORT_TYPE.MARKDOWN]: MarkdownExportService,
  [EXPORT_TYPE.ZIP]: ZipExportService,
};

export class ExportService {
  private readonly exportRepository = new CrawlExportRepository();
  private readonly crawlJobRepository = new CrawlJobRepository();

  async generate(job: CrawlJob, exportType: ExportType) {
    const jobWithPages = await this.crawlJobRepository.findByIdWithPages(
      job.id,
    );

    const fullJob = jobWithPages as CrawlJob & { pages: CrawlPage[] };

    const ServiceClass = EXPORT_SERVICES[exportType];
    if (!ServiceClass) {
      throw new AppError(
        `Unsupported export type: ${exportType}`,
        400,
        ERROR_CODE.UNSUPPORTED_EXPORT_TYPE,
      );
    }

    const service = new ServiceClass();
    const result = await service.export(fullJob);

    const retentionDays = await systemConfigService.get<number>(
      "retention.exports_days",
      DEFAULT_EXPORT_RETENTION_DAYS,
    );

    const expiredAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );

    const exportRecord = await this.exportRepository.create({
      jobId: job.id,
      exportType,
      fileName: result.fileName,
      filePath: result.filePath,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      expiredAt,
    });

    const completedExportRecord = await this.exportRepository.update(
      exportRecord.id,
      {
        status: JOB_STATUS.COMPLETED,
      },
    );

    return completedExportRecord;
  }
}
