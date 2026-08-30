export interface VocabularyCounts {
  uniqueWords: number;
  knownWords: number;
  learningWords: number;
  explicitNewWords: number;
  ignoredWords: number;
  unclassifiedWords: number;
}

export function calculateKnownPercentage(
  reading: Pick<VocabularyCounts, 'uniqueWords' | 'knownWords'>
): number {
  return reading.uniqueWords > 0
    ? Math.round((reading.knownWords / reading.uniqueWords) * 100)
    : 0;
}

export function calculateWordsToLearn(
  reading: Pick<VocabularyCounts, 'explicitNewWords' | 'unclassifiedWords'>
): number {
  return reading.explicitNewWords + reading.unclassifiedWords;
}

export function wordCountLabel(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function toVocabularyCard<T extends VocabularyCounts>(reading: T) {
  const wordsToLearn = calculateWordsToLearn(reading);
  return {
    reading,
    knownPercentage: calculateKnownPercentage(reading),
    wordsToLearn,
    knownLabel: wordCountLabel(reading.knownWords, 'palabra conocida', 'palabras conocidas'),
    learningLabel: wordCountLabel(reading.learningWords, 'palabra que estás aprendiendo', 'palabras que estás aprendiendo'),
    wordsToLearnLabel: wordCountLabel(wordsToLearn, 'palabra por aprender', 'palabras por aprender'),
  };
}
