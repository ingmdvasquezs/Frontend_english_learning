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
