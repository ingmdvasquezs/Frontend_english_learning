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

export type ReviewBatchSize = 10 | 20 | 30;

export type ReviewAssessment = 'FORGOT' | 'STRUGGLED' | 'REMEMBERED';

export interface PreparedReviewEntry {
  wordId: string;
  word: string;
  language: string;
  status: VocabularyStatus;
}

export interface PreparedReviewSession {
  dueCount: number;
  totalReviewableCount: number;
  entries: PreparedReviewEntry[];
}

export interface ReviewResult {
  wordId: string;
  status: VocabularyStatus;
}

export interface ReviewResultItem {
  word: string;
  previousStatus: VocabularyStatus;
  targetStatus: VocabularyStatus;
  assessment: ReviewAssessment;
}
