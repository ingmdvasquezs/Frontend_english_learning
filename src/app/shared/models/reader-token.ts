import { VocabularyStatus } from './vocabulary-status';

export type ReaderTokenType = 'WORD' | 'PUNCTUATION' | 'WHITESPACE';

export interface ReaderToken {
  value: string;
  normalizedValue: string | null;
  type: ReaderTokenType;
  status: VocabularyStatus | null;
}
