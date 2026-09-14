import { ReadingProgressStatus } from '../../../shared/models/reading-progress-status';

export interface UserReading {
  readingId: string;
  title: string;
  language: string;
  createdAt: string | null;
  uniqueWords: number;
  knownWords: number;
  learningWords: number;
  explicitNewWords: number;
  ignoredWords: number;
  unclassifiedWords: number;
  vocabularyFitPercentage?: number | null;
  classificationConfidencePercentage?: number | null;
  progressStatus: ReadingProgressStatus | null;
}

export interface UserReadingsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: UserReading[];
}

export interface DeleteReadingResponse {
  success: boolean;
}

export interface RegisteredReading {
  readingId: string;
  title: string;
  language: string;
  createdAt: string;
}

export type EditorialLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface PlatformReadingHistoryItem {
  readingId: string;
  title: string;
  editorialLevel: EditorialLevel;
  category: string;
  coverKey?: string | null;
  progressStatus: 'IN_PROGRESS' | 'COMPLETED';
}

export interface PlatformReadingHistoryPage {
  page: number;
  size: number;
  totalElements: number;
  readings: PlatformReadingHistoryItem[];
}
