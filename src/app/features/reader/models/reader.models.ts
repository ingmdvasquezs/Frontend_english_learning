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

export type QuestionType = 'FACTUAL' | 'INFERENCE' | 'MAIN_IDEA';

export interface ComprehensionQuizOption {
  optionId: string;
  ordinal: number;
  content: string;
}

export interface ComprehensionQuizQuestion {
  questionId: string;
  ordinal: number;
  questionType: QuestionType;
  prompt: string;
  options: ComprehensionQuizOption[];
}

export interface ComprehensionQuiz {
  readingId: string;
  available: boolean;
  questions: ComprehensionQuizQuestion[];
  selectionVersion: number | null;
}

export interface ComprehensionAnswerInput {
  questionId: string;
  selectedOptionId: string;
}

export interface SubmitComprehensionAttemptRequest {
  readingId: string;
  submissionId: string;
  answers: ComprehensionAnswerInput[];
  selectionVersion: number;
}

export interface ComprehensionQuestionResultOption {
  optionId: string;
  ordinal: number;
  content: string;
}

export interface ComprehensionQuestionResult {
  questionId: string;
  ordinal: number;
  questionType: QuestionType;
  prompt: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: string;
  options: ComprehensionQuestionResultOption[];
}

export interface ComprehensionAttemptResult {
  attemptId: string;
  readingId: string;
  submissionId: string;
  scorePercentage: number;
  correctAnswersCount: number;
  totalQuestionsCount: number;
  submittedAt: string;
  questions: ComprehensionQuestionResult[];
}
