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
  description?: string | null;
  countryCode?: string | null;
  discoveryTopic?: string | null;
}

export interface DiscoveryHeroImage {
  assetKey: string;
  location?: string | null;
  alt?: string | null;
  displayOrder: number;
}

export interface DiscoveryTopicSummary {
  key: string;
  displayName: string;
  displayOrder: number;
  readingCount: number;
}

export interface DiscoveryCountrySummary {
  countryCode: string;
  displayName: string;
  tagline: string;
  description: string;
  displayOrder: number;
  readingCount: number;
  heroImages: DiscoveryHeroImage[];
  topics: DiscoveryTopicSummary[];
}

export interface DiscoveryRegionDetails {
  key: string;
  displayName: string;
  subtitle?: string | null;
}

export interface DiscoveryRegionOverview {
  region: DiscoveryRegionDetails;
  countries: DiscoveryCountrySummary[];
}

export interface LatinAmericaDiscovery {
  region: DiscoveryRegionDetails;
  countries: DiscoveryCountrySummary[];
  defaultCountryCode: string;
  defaultTopicKey?: string | null;
  readings: RecommendedPlatformReading[];
}

export interface DiscoveryShelf {
  key: string;
  title: string;
  description: string;
  displayOrder: number;
  coverKey: string | null;
  type: string;
  totalReadings: number;
  readings: RecommendedPlatformReading[];
}

export interface DiscoveryHome {
  continueReading: ContinueReadingItem[];
  forYou: RecommendedPlatformReading[];
  latinAmerica: LatinAmericaDiscovery | null;
  shelves: DiscoveryShelf[];
}

export interface BrowsePlatformReadingsFilters {
  collectionKey?: string | null;
  category?: string | null;
  editorialLevel?: EditorialLevel | null;
  countryCode?: string | null;
  discoveryTopic?: string | null;
  sort?: 'DEFAULT' | 'CREATED_AT_DESC' | null;
  page?: number;
  size?: number;
}

export interface BrowsePlatformReadingsPage {
  page: number;
  size: number;
  totalElements: number;
  readings: RecommendedPlatformReading[];
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
  readingCount?: number | null;
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
  /** Porcentaje de progreso (0–100). Opcional — sólo se muestra si el backend lo entrega. */
  progressPercentage?: number | null;
  /** Descripción o extracto breve. Opcional — para preview editorial o cuando backend lo soporte. */
  description?: string | null;
}

export interface ContinueReadingPage {
  page: number;
  size: number;
  totalElements: number;
  readings: ContinueReadingItem[];
}
