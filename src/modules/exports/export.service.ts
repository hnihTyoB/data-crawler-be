import { CrawlJob, CrawlPage, ExportType } from '@prisma/client';
import { CrawlJobRepository } from '../crawl-jobs/crawl-job.repository';
import { CrawlExportRepository } from '../crawl-exports/crawl-export.repository';
import { JsonExportService } from './json-export.service';
import { CsvExportService } from './csv-export.service';
import { XlsxExportService } from './xlsx-export.service';
import { MarkdownExportService } from './markdown-export.service';
import { ZipExportService } from './zip-export.service';
import { IExportService } from './base-export.service';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

const EXPORT_SERVICES: Record<ExportType, new () => IExportService> = {
  JSON: JsonExportService,
  CSV: CsvExportService,
  XLSX: XlsxExportService,
  MARKDOWN: MarkdownExportService,
  ZIP: ZipExportService,
};

export class ExportService {
  private readonly exportRepository = new CrawlExportRepository();
  private readonly crawlJobRepository = new CrawlJobRepository();

  async generate(job: CrawlJob, exportType: ExportType) {
    const jobWithPages = await this.crawlJobRepository.findByIdWithPages(job.id);

    const fullJob = jobWithPages as CrawlJob & { pages: CrawlPage[] };

    const ServiceClass = EXPORT_SERVICES[exportType];
    if (!ServiceClass) {
      throw new AppError(`Unsupported export type: ${exportType}`, 400, ERROR_CODE.UNSUPPORTED_EXPORT_TYPE);
    }

    const service = new ServiceClass();
    const result = await service.export(fullJob);

    const exportRecord = await this.exportRepository.create({
      jobId: job.id,
      exportType,
      fileName: result.fileName,
      filePath: result.filePath,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
    });

    const completedExportRecord = await this.exportRepository.update(
      exportRecord.id,
      {
        status: 'COMPLETED',
      },
    );

    return completedExportRecord;
  }
}

