export interface VocabularyCounts {
  uniqueWords: number;
  knownWords: number;
  learningWords: number;
  explicitNewWords: number;
  ignoredWords: number;
  unclassifiedWords: number;
}

export type VocabularyFitTone = 'discovery' | 'mature' | 'unknown';

export interface VocabularyFitEvidence {
  reasonCode?: string | null;
  classificationConfidencePercentage?: number | null;
}

/**
 * Official backend threshold from RecommendationReasonEvaluator.
 * Refers to CLASSIFICATION CONFIDENCE, NOT vocabulary fit percentage.
 */
export const CONFIDENCE_MATURE_THRESHOLD = 40;

/**
 * Resolves the semantic tone for vocabulary fit indicators.
 * - 'discovery' (amber): limited evidence / discovery mode / confidence < 40%
 * - 'mature' (green): sufficient evidence / mature personalization / confidence >= 40%
 * - 'unknown' (neutral/muted): neither reasonCode nor confidence is available
 *
 * Priority order:
 * 1. reasonCode present:
 *    'DISCOVERY' => 'discovery'
 *    any mature reason => 'mature'
 * 2. reasonCode absent + confidence is finite number:
 *    confidence < 40 => 'discovery'
 *    confidence >= 40 => 'mature'
 * 3. No signal => 'unknown'
 *
 * NOTE: Does NOT use vocabularyFitPercentage to determine tone.
 */
export function resolveVocabularyFitTone(
  evidence?: VocabularyFitEvidence | null
): VocabularyFitTone {
  if (!evidence) return 'unknown';

  if (typeof evidence.reasonCode === 'string' && evidence.reasonCode.trim() !== '') {
    return evidence.reasonCode === 'DISCOVERY' ? 'discovery' : 'mature';
  }

  const confidence = evidence.classificationConfidencePercentage;
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return confidence < CONFIDENCE_MATURE_THRESHOLD ? 'discovery' : 'mature';
  }

  return 'unknown';
}

export function vocabularyFitAriaLabel(tone: VocabularyFitTone): string {
  switch (tone) {
    case 'discovery':
      return 'Vocabulary fit estimate — limited evidence';
    case 'mature':
      return 'Vocabulary fit';
    case 'unknown':
      return 'Vocabulary fit — evidence unavailable';
  }
}

interface VocabularyFit extends VocabularyFitEvidence {
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
      : `${vocabularyFitPercentage}% vocab fit`,
    vocabularyFitLabelEn: vocabularyFitPercentage === null
      ? null
      : `${vocabularyFitPercentage}% vocab fit`,
    compatibilityLabelEn: vocabularyFitPercentage === null
      ? null
      : `Compatibility ${vocabularyFitPercentage}%`,
    knownWordsLabelEn: `${knownWords} Known words`,
    learningWordsLabelEn: `${learningWords} Learning words`,
    wordsToLearnLabelEn: `${wordsToLearn} Words to learn`,
    fitTone: resolveVocabularyFitTone(reading),
    fitAriaLabel: vocabularyFitAriaLabel(resolveVocabularyFitTone(reading)),
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
