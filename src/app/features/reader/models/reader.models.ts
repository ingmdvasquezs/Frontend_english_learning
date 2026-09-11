import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import { ReadingProgressStatus } from '../../../shared/models/reading-progress-status';

export * from '../../../shared/models/reader-token';
import { ReaderToken } from '../../../shared/models/reader-token';

export interface ReaderData {
  readingId: string;
  title: string;
  language: string;
  progressStatus: ReadingProgressStatus | null;
  currentPartOrdinal?: number | null;
  paginationVersion?: number | null;
  tokens: ReaderToken[];
}

export interface UpdateReadingProgressRequest {
  readingId: string;
  progressStatus: ReadingProgressStatus;
  currentPartOrdinal: number;
  paginationVersion: number;
}

export interface CompleteReadingResult {
  readingId: string;
  status: ReadingProgressStatus;
  startedAt: string;
  completedAt: string;
}
