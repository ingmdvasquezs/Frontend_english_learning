/**
 * Centralized reading cover URL resolver.
 * Prepares the frontend for future S3/CloudFront CDN resolution without breaking local assets.
 */
export function resolveReadingCoverUrl(coverKey: string | null | undefined): string | null {
  if (!coverKey || typeof coverKey !== 'string') return null;
  const key = coverKey.trim();
  if (!key) return null;

  // If already an absolute URL (e.g. S3/CloudFront CDN URL in the future)
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  // Contractual WebP asset path
  return `/assets/reading-covers/${key}.webp`;
}

export const coverUrl = resolveReadingCoverUrl;
