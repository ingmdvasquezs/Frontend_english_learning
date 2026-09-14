/**
 * TEMPORARY VISUAL PREVIEW.
 * Replace with backend reading descriptions when available.
 *
 * Este archivo provee descripciones breves editoriales para maquetar
 * la anatomía completa de las cards de recomendación (V7.1).
 */

export const RECOMMENDATION_EDITORIAL_DESCRIPTIONS_BY_KEY: Record<string, string> = {
  'the-camera-on-platform-three': 'A reflective encounter at a train station prompts an unexpected conversation about memory and time.',
  'the-translation-at-midnight': 'A translator uncovers subtle meanings in an old letter, finding echoes of personal choices.',
  'the-archive-of-small-decisions': 'An archivist discovers that ordinary everyday choices carry the greatest historical weight.',
  'the-clockmakers-apprentice': 'In a quiet workshop, precision and patience shape both intricate gears and life lessons.',
  'the-botanists-notebook': 'Field notes from a forgotten expedition reveal secrets hidden within the cloud forest.',
  'the-grammar-of-tides': 'A coastal community reads the rhythm of ocean tides to navigate changes in everyday life.',
};

const DEFAULT_RECOMMENDATION_DESCRIPTIONS: string[] = [
  'A reflective encounter prompts an unexpected conversation about memory and time.',
  'A translator uncovers subtle meanings in an old letter, finding echoes of personal choices.',
  'An archivist discovers that ordinary everyday choices carry the greatest historical weight.',
  'In a quiet workshop, precision and patience shape both intricate gears and life lessons.',
  'Field notes from a forgotten expedition reveal secrets hidden within the cloud forest.',
  'A coastal community reads the rhythm of ocean tides to navigate changes in everyday life.',
];

export function resolveRecommendationPreview(
  readingId?: string | null,
  coverKey?: string | null,
  index = 0
): string | null {
  if (coverKey && RECOMMENDATION_EDITORIAL_DESCRIPTIONS_BY_KEY[coverKey]) {
    return RECOMMENDATION_EDITORIAL_DESCRIPTIONS_BY_KEY[coverKey];
  }
  if (readingId && RECOMMENDATION_EDITORIAL_DESCRIPTIONS_BY_KEY[readingId]) {
    return RECOMMENDATION_EDITORIAL_DESCRIPTIONS_BY_KEY[readingId];
  }
  return DEFAULT_RECOMMENDATION_DESCRIPTIONS[index % DEFAULT_RECOMMENDATION_DESCRIPTIONS.length];
}
