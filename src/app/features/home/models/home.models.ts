import { ReadingProgressStatus } from '../../../shared/models/reading-progress-status';

export type EditorialLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type RecommendationReasonCode =
  | 'CONTINUE_READING'
  | 'DISCOVERY'
  | 'HIGH_VOCABULARY_MATCH'
  | 'PRACTICE_VOCABULARY'
  | 'BALANCED_CHALLENGE'
  | 'MORE_CHALLENGING';

export interface RecommendedPlatformReading {
  readingId: string;
  title: string;
  language: string;
  editorialLevel: EditorialLevel;
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
  coverKey: string | null;
  reasonCode?: RecommendationReasonCode | null;
}

export interface PlatformReadingRecommendationsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: RecommendedPlatformReading[];
}

export interface ReadingCollection {
  key: string;
  displayName: string;
  description: string;
  displayOrder: number;
  coverKey: string | null;
}

export interface CollectionReadingsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: RecommendedPlatformReading[];
}

export type ReadingOrigin = 'USER' | 'PLATFORM';

export interface ContinueReadingItem {
  readingId: string;
  title: string;
  origin: ReadingOrigin;
  progressStatus: ReadingProgressStatus;
  coverKey: string | null;
  editorialLevel: EditorialLevel | null;
  category: string | null;
  startedAt: string;
}

export interface ContinueReadingPage {
  page: number;
  size: number;
  totalElements: number;
  readings: ContinueReadingItem[];
}
