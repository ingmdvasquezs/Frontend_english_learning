import { RecommendationReasonCode } from '../models/home.models';

export const RECOMMENDATION_REASON_COPY: Readonly<Record<RecommendationReasonCode, string>> = {
  CONTINUE_READING: 'Continúa donde lo dejaste.',
  DISCOVERY: 'Estamos conociendo tu vocabulario para mejorar tus recomendaciones.',
  HIGH_VOCABULARY_MATCH: 'Gran parte del vocabulario de esta lectura ya te resulta familiar.',
  PRACTICE_VOCABULARY: 'Esta lectura puede ayudarte a reforzar palabras que estás aprendiendo.',
  BALANCED_CHALLENGE: 'Combina vocabulario familiar con nuevas palabras por descubrir.',
  MORE_CHALLENGING: 'Esta lectura ofrece un reto de vocabulario un poco mayor.',
};

/**
 * Returns the localized user-friendly explanation for a given recommendation reasonCode.
 * Returns null if the reasonCode is null, undefined, or not a recognized value.
 */
export function recommendationReasonCopy(
  reasonCode: RecommendationReasonCode | string | null | undefined
): string | null {
  if (!reasonCode) {
    return null;
  }
  const key = reasonCode.trim() as RecommendationReasonCode;
  return RECOMMENDATION_REASON_COPY[key] ?? null;
}

/**
 * Safely parses an arbitrary raw string into a known RecommendationReasonCode, or null.
 */
export function parseRecommendationReasonCode(
  raw: string | null | undefined
): RecommendationReasonCode | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed in RECOMMENDATION_REASON_COPY ? (trimmed as RecommendationReasonCode) : null;
}

