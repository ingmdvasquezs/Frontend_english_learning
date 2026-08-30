import { ReadingProgressStatus } from '../../../shared/models/reading-progress-status';

export interface RecommendedPlatformReading {
  readingId: string;
  title: string;
  language: string;
  editorialLevel: string;
  category: string;
  createdAt: string | null;
  uniqueWords: number;
  knownWords: number;
  learningWords: number;
  explicitNewWords: number;
  ignoredWords: number;
  unclassifiedWords: number;
  vocabularyFitPercentage: number;
  classificationConfidencePercentage: number;
  progressStatus: ReadingProgressStatus | null;
}

export interface PlatformReadingRecommendationsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: RecommendedPlatformReading[];
}
