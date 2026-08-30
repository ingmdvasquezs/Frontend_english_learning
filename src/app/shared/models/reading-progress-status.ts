export type ReadingProgressStatus = 'IN_PROGRESS' | 'COMPLETED';

export function parseReadingProgressStatus(
  value: string | null
): ReadingProgressStatus | null {
  if (value === null || value.trim() === '') return null;
  if (value === 'IN_PROGRESS' || value === 'COMPLETED') return value;
  throw new Error('Invalid SOAP response: invalid progress status');
}
