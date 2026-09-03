import { CrawlPageRepository } from "./crawl-page.repository";
import { CrawlPageStatus } from "@prisma/client";
import { CrawlPageQueryDto } from "./crawl-page.dto";
import {
  extractMainContent,
  stripMarkdown,
} from "../../common/helpers/data-contract.helper";

export class CrawlPageService {
  private readonly repository = new CrawlPageRepository();

  async findByJobId(jobId: string, query?: CrawlPageQueryDto) {
    const result = await this.repository.findByJobId(jobId, query);
    const isPreview = query?.preview === true || query?.preview === "true";

    if (isPreview) {
      result.items = result.items.map((item) => {
        const rawMarkdown =
          (item as { markdownContent?: string | null }).markdownContent ?? null;
        const mainContent = extractMainContent(rawMarkdown) || null;
        const cleanText = mainContent ? stripMarkdown(mainContent) : null;
        return {
          ...item,
          rawMarkdown,
          mainContent,
          cleanText,
        };
      });
    }

    return result;
  }

  async create(data: {
    jobId: string;
    url: string;
    title?: string;
    description?: string;
    markdownContent?: string;
    status?: CrawlPageStatus;
    statusCode?: number;
    errorMessage?: string;
    crawledAt?: Date;
  }) {
    return this.repository.create(data);
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      markdownContent?: string;
      status?: CrawlPageStatus;
      statusCode?: number;
      errorMessage?: string;
      crawledAt?: Date;
    },
  ) {
    return this.repository.update(id, data);
  }
}
