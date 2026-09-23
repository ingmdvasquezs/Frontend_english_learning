import { VocabularyStatus } from '../../../shared/models/vocabulary-status';

export interface VocabularySummary {
  totalCount: number;
  newCount: number;
  learningCount: number;
  knownCount: number;
  ignoredCount: number;
}

export interface VocabularyEntry {
  entryId: string;
  wordId: string;
  word: string;
  language: string;
  status: VocabularyStatus;
  firstSeenAt: string | null;
}

export interface UserVocabularyPage {
  page: number;
  size: number;
  totalElements: number;
  summary: VocabularySummary;
  entries: VocabularyEntry[];
}

export type VocabularyFilter = 'ALL' | VocabularyStatus;

export type ReviewBatchSize = 10 | 15 | 20 | 30;

export type ReviewAssessment = 'FORGOT' | 'STRUGGLED' | 'REMEMBERED';

export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export type SrsState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

export interface RatingOption {
  rating: ReviewRating;
  nextReviewAt?: string;
  intervalSeconds: number;
}

export interface PreparedReviewEntry {
  wordId: string;
  word: string;
  language: string;
  status: VocabularyStatus;
  srsState?: SrsState | null;
  ratingOptions?: RatingOption[];
  pendingQueueSequence?: number | null;
  baseOrder?: number | null;
  nextReviewAt?: string | null;
}

export interface PreparedReviewSession {
  dueCount: number;
  totalReviewableCount: number;
  dailyLimit?: number;
  dailyBaseCompleted?: number;
  dailyBaseRemaining?: number;
  pendingLearningCount?: number;
  dailyComplete?: boolean;
  entries: PreparedReviewEntry[];
  learnAheadEntries?: PreparedReviewEntry[];
}

export interface ReviewResult {
  wordId: string;
  status: VocabularyStatus;
  srsState?: SrsState | null;
  nextReviewAt?: string | null;
  intervalSeconds?: number | null;
  stability?: number | null;
  difficulty?: number | null;
  ratingOptions?: RatingOption[];
  pendingQueueSequence?: number | null;
  baseOrder?: number | null;
}

export interface ReviewResultItem {
  word: string;
  previousStatus: VocabularyStatus;
  targetStatus: VocabularyStatus;
  rating?: ReviewRating;
  assessment?: ReviewAssessment;
}
