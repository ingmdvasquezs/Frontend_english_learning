import { describe, expect, it } from 'vitest';
import {
  calculateKnownPercentage,
  calculateWordsToLearn,
  CONFIDENCE_MATURE_THRESHOLD,
  resolveVocabularyFitTone,
  toVocabularyCard,
  vocabularyFitAriaLabel,
  wordCountLabel,
} from './reading-metrics';

describe('reading-metrics utilities', () => {
  describe('CONFIDENCE_MATURE_THRESHOLD', () => {
    it('is exactly 40 as defined by backend RecommendationReasonEvaluator', () => {
      expect(CONFIDENCE_MATURE_THRESHOLD).toBe(40);
    });
  });

  describe('resolveVocabularyFitTone', () => {
    it('resolves DISCOVERY reasonCode to "discovery" regardless of confidence or fit', () => {
      expect(resolveVocabularyFitTone({ reasonCode: 'DISCOVERY' })).toBe('discovery');
      expect(resolveVocabularyFitTone({ reasonCode: 'DISCOVERY', classificationConfidencePercentage: 90 })).toBe('discovery');
    });

    it.each([
      'HIGH_VOCABULARY_MATCH',
      'PRACTICE_VOCABULARY',
      'BALANCED_CHALLENGE',
      'MORE_CHALLENGING',
      'CONTINUE_READING',
    ])('resolves mature reasonCode "%s" to "mature"', (reasonCode) => {
      expect(resolveVocabularyFitTone({ reasonCode })).toBe('mature');
      expect(resolveVocabularyFitTone({ reasonCode, classificationConfidencePercentage: 10 })).toBe('mature');
    });

    it('resolves to "discovery" when reasonCode is absent and confidence < 40', () => {
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 20 })).toBe('discovery');
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 0 })).toBe('discovery');
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 39.9 })).toBe('discovery');
    });

    it('resolves to "mature" when reasonCode is absent and confidence >= 40', () => {
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 40 })).toBe('mature');
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 85 })).toBe('mature');
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: 100 })).toBe('mature');
    });

    it('resolves to "unknown" when neither reasonCode nor confidence is available', () => {
      expect(resolveVocabularyFitTone(null)).toBe('unknown');
      expect(resolveVocabularyFitTone(undefined)).toBe('unknown');
      expect(resolveVocabularyFitTone({})).toBe('unknown');
      expect(resolveVocabularyFitTone({ reasonCode: null, classificationConfidencePercentage: null })).toBe('unknown');
      expect(resolveVocabularyFitTone({ reasonCode: undefined, classificationConfidencePercentage: undefined })).toBe('unknown');
    });

    // CRITICAL REQUIREMENT: percentage value does NOT determine color tone
    it('resolves low numeric fit (13%) with mature evidence to "mature" (GREEN)', () => {
      expect(resolveVocabularyFitTone({
        reasonCode: 'HIGH_VOCABULARY_MATCH',
        classificationConfidencePercentage: 85,
      })).toBe('mature');

      expect(resolveVocabularyFitTone({
        reasonCode: null,
        classificationConfidencePercentage: 85,
      })).toBe('mature');
    });

    it('resolves high numeric fit (76%) with discovery evidence to "discovery" (AMBER)', () => {
      expect(resolveVocabularyFitTone({
        reasonCode: 'DISCOVERY',
        classificationConfidencePercentage: 20,
      })).toBe('discovery');

      expect(resolveVocabularyFitTone({
        reasonCode: null,
        classificationConfidencePercentage: 20,
      })).toBe('discovery');
    });

    it('resolves fit of 50% without evidence signal to "unknown" (NEUTRAL, not green)', () => {
      expect(resolveVocabularyFitTone({
        reasonCode: null,
        classificationConfidencePercentage: null,
      })).toBe('unknown');
    });
  });

  describe('vocabularyFitAriaLabel', () => {
    it('returns "Vocabulary fit estimate — limited evidence" for discovery', () => {
      expect(vocabularyFitAriaLabel('discovery')).toBe('Vocabulary fit estimate — limited evidence');
    });

    it('returns "Vocabulary fit" for mature', () => {
      expect(vocabularyFitAriaLabel('mature')).toBe('Vocabulary fit');
    });

    it('returns "Vocabulary fit — evidence unavailable" for unknown', () => {
      expect(vocabularyFitAriaLabel('unknown')).toBe('Vocabulary fit — evidence unavailable');
    });
  });

  describe('toVocabularyCard', () => {
    it('computes fitTone and fitAriaLabel from evidence on reading item', () => {
      const cardDiscovery = toVocabularyCard({
        uniqueWords: 100,
        knownWords: 10,
        learningWords: 5,
        explicitNewWords: 5,
        ignoredWords: 0,
        unclassifiedWords: 80,
        vocabularyFitPercentage: 13,
        reasonCode: 'DISCOVERY',
        classificationConfidencePercentage: 20,
      });
      expect(cardDiscovery.fitTone).toBe('discovery');
      expect(cardDiscovery.fitAriaLabel).toBe('Vocabulary fit estimate — limited evidence');
      expect(cardDiscovery.vocabularyFitLabel).toBe('13% vocab fit');

      const cardMature = toVocabularyCard({
        uniqueWords: 100,
        knownWords: 70,
        learningWords: 10,
        explicitNewWords: 5,
        ignoredWords: 0,
        unclassifiedWords: 15,
        vocabularyFitPercentage: 76,
        reasonCode: 'HIGH_VOCABULARY_MATCH',
        classificationConfidencePercentage: 90,
      });
      expect(cardMature.fitTone).toBe('mature');
      expect(cardMature.fitAriaLabel).toBe('Vocabulary fit');
      expect(cardMature.vocabularyFitLabel).toBe('76% vocab fit');

      const cardUnknown = toVocabularyCard({
        uniqueWords: 100,
        knownWords: 50,
        learningWords: 0,
        explicitNewWords: 0,
        ignoredWords: 0,
        unclassifiedWords: 50,
        vocabularyFitPercentage: 50,
        reasonCode: null,
        classificationConfidencePercentage: null,
      });
      expect(cardUnknown.fitTone).toBe('unknown');
      expect(cardUnknown.fitAriaLabel).toBe('Vocabulary fit — evidence unavailable');
      expect(cardUnknown.vocabularyFitLabel).toBe('50% vocab fit');
    });
  });

  describe('basic calculations', () => {
    it('calculates known percentage correctly', () => {
      expect(calculateKnownPercentage({ uniqueWords: 200, knownWords: 150 })).toBe(75);
      expect(calculateKnownPercentage({ uniqueWords: 0, knownWords: 0 })).toBe(0);
    });

    it('calculates words to learn correctly', () => {
      expect(calculateWordsToLearn({ explicitNewWords: 5, unclassifiedWords: 20 })).toBe(25);
    });

    it('formats word count labels correctly', () => {
      expect(wordCountLabel(1, 'palabra', 'palabras')).toBe('1 palabra');
      expect(wordCountLabel(3, 'palabra', 'palabras')).toBe('3 palabras');
    });
  });
});
