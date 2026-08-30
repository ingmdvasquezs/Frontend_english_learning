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
  progressStatus: ReadingProgressStatus | null;
}

export interface UserReadingsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: UserReading[];
}

export interface RegisteredReading {
  readingId: string;
  title: string;
  language: string;
  createdAt: string;
}
