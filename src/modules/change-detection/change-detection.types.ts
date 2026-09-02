export interface NewPageItem {
  url: string;
  normalizedUrl: string;
  title: string | null;
  contentHash: string | null;
  wordCount: number;
  statusCode: number | null;
  crawledAt: string | null;
}

export interface ModifiedPageItem {
  url: string;
  normalizedUrl: string;
  title: string | null;
  oldTitle: string | null;
  oldContentHash: string | null;
  newContentHash: string | null;
  oldWordCount: number;
  newWordCount: number;
  wordCountDiff: number;
  statusCode: number | null;
  crawledAt: string | null;
}

export interface DeletedPageItem {
  url: string;
  normalizedUrl: string;
  title: string | null;
  previousContentHash: string | null;
  previousWordCount: number;
  lastCrawledAt: string | null;
}

export interface UnchangedPageItem {
  url: string;
  normalizedUrl: string;
  title: string | null;
  contentHash: string | null;
  wordCount: number;
}

export interface DiffSummary {
  totalCurrentPages: number;
  totalPreviousPages: number;
  newPagesCount: number;
  modifiedPagesCount: number;
  deletedPagesCount: number;
  unchangedPagesCount: number;
  changeRate: number;
}

export interface DiffReportEnvelope {
  schemaVersion: string;
  generatedAt: string;
  jobId: string;
  previousJobId: string | null;
  scheduleId: string | null;
  startUrl: string;
  domain: string | null;
  summary: DiffSummary;
  changes: {
    new: NewPageItem[];
    modified: ModifiedPageItem[];
    deleted: DeletedPageItem[];
    unchanged: UnchangedPageItem[];
  };
}
