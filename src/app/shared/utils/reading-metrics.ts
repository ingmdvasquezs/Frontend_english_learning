export interface VocabularyCounts {
  uniqueWords: number;
  knownWords: number;
  learningWords: number;
  explicitNewWords: number;
  ignoredWords: number;
  unclassifiedWords: number;
}

interface VocabularyFit {
  vocabularyFitPercentage?: number | null;
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

export function toVocabularyCard<T extends VocabularyCounts & VocabularyFit>(reading: T) {
  const knownWords = normalizedWordCount(reading.knownWords);
  const learningWords = normalizedWordCount(reading.learningWords);
  const wordsToLearn = normalizedWordCount(reading.explicitNewWords)
    + normalizedWordCount(reading.unclassifiedWords);
  const compactKnownLabel = wordCountLabel(knownWords, 'conocida', 'conocidas');
  const compactLearningLabel = learningWords > 0
    ? `${learningWords} en aprendizaje`
    : null;
  const vocabularyFitPercentage = normalizedPercentage(
    reading.vocabularyFitPercentage
  );

  return {
    reading,
    knownPercentage: calculateKnownPercentage(reading),
    wordsToLearn,
    knownLabel: wordCountLabel(knownWords, 'palabra conocida', 'palabras conocidas'),
    learningLabel: wordCountLabel(learningWords, 'palabra que estás aprendiendo', 'palabras que estás aprendiendo'),
    wordsToLearnLabel: wordCountLabel(wordsToLearn, 'palabra por aprender', 'palabras por aprender'),
    compactKnownLabel,
    compactLearningLabel,
    vocabularySummaryLabel: compactLearningLabel
      ? `${compactKnownLabel} · ${compactLearningLabel}`
      : compactKnownLabel,
    vocabularyFitPercentage,
    vocabularyFitLabel: vocabularyFitPercentage === null
      ? 'Compatibilidad no disponible'
      : `Compatibilidad ${vocabularyFitPercentage}%`,
  };
}

function normalizedWordCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 0;
}

function normalizedPercentage(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}
