import { VocabularyStatus } from '../../../shared/models/vocabulary-status';

export type { VocabularyStatus } from '../../../shared/models/vocabulary-status';

export interface InitialVocabularyTest {
  testId: string;
  text: string;
  selectableWords: string[];
}

export interface VocabularyClassification {
  word: string;
  status: VocabularyStatus;
}
