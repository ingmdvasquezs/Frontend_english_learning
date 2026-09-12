import { describe, expect, it } from 'vitest';
import { RecommendationReasonCode } from '../models/home.models';
import {
  RECOMMENDATION_REASON_COPY,
  parseRecommendationReasonCode,
  recommendationReasonCopy,
} from './recommendation-reason';

describe('recommendationReasonCopy', () => {
  const expectedCopies: Record<RecommendationReasonCode, string> = {
    CONTINUE_READING: 'Continúa donde lo dejaste.',
    DISCOVERY: 'Estamos conociendo tu vocabulario para mejorar tus recomendaciones.',
    HIGH_VOCABULARY_MATCH: 'Gran parte del vocabulario de esta lectura ya te resulta familiar.',
    PRACTICE_VOCABULARY: 'Esta lectura puede ayudarte a reforzar palabras que estás aprendiendo.',
    BALANCED_CHALLENGE: 'Combina vocabulario familiar con nuevas palabras por descubrir.',
    MORE_CHALLENGING: 'Esta lectura ofrece un reto de vocabulario un poco mayor.',
  };

  it.each(Object.entries(expectedCopies))(
    'maps reasonCode %s to the exact friendly explanation',
    (code, expectedText) => {
      const result = recommendationReasonCopy(code as RecommendationReasonCode);
      expect(result).toBe(expectedText);
      expect(RECOMMENDATION_REASON_COPY[code as RecommendationReasonCode]).toBe(expectedText);
    }
  );

  it.each([null, undefined, '', '   '])(
    'returns null for absent or empty reasonCode: %s',
    (value) => {
      expect(recommendationReasonCopy(value)).toBeNull();
    }
  );

  it('returns null for an unsupported/unknown reasonCode without throwing', () => {
    expect(recommendationReasonCopy('UNKNOWN_REASON')).toBeNull();
    expect(recommendationReasonCopy('RANDOM_CODE')).toBeNull();
  });

  it('never outputs technical code words or user CEFR diagnoses', () => {
    const allCopies = Object.values(RECOMMENDATION_REASON_COPY);
    for (const text of allCopies) {
      expect(text).not.toMatch(/CONTINUE_READING|DISCOVERY|HIGH_VOCABULARY_MATCH|PRACTICE_VOCABULARY|BALANCED_CHALLENGE|MORE_CHALLENGING/);
      expect(text).not.toMatch(/eres\s+[A-C][12]|tu nivel|nivel\s+[A-C][12]|diagn[oó]stico|examen/i);
    }
  });
});

describe('parseRecommendationReasonCode', () => {
  it('parses valid reason codes', () => {
    expect(parseRecommendationReasonCode('DISCOVERY')).toBe('DISCOVERY');
    expect(parseRecommendationReasonCode(' HIGH_VOCABULARY_MATCH  ')).toBe('HIGH_VOCABULARY_MATCH');
    expect(parseRecommendationReasonCode('CONTINUE_READING')).toBe('CONTINUE_READING');
  });

  it('returns null for unknown codes or null/undefined/empty', () => {
    expect(parseRecommendationReasonCode('UNKNOWN_CODE')).toBeNull();
    expect(parseRecommendationReasonCode(null)).toBeNull();
    expect(parseRecommendationReasonCode(undefined)).toBeNull();
    expect(parseRecommendationReasonCode('')).toBeNull();
  });
});
