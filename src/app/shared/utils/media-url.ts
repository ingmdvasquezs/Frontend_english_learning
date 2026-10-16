import { environment } from '../../../environments/environment';

export const PLATFORM_MEDIA_PREFIXES = ['covers/', 'countries/', 'collections/'] as const;

/**
 * Checks whether a cleaned key is a Platform Media key.
 */
export function isPlatformMediaKey(cleanKey: string): boolean {
  return PLATFORM_MEDIA_PREFIXES.some((prefix) => cleanKey.startsWith(prefix));
}

/**
 * Centralized platform media URL resolver.
 * Handles platform media keys (covers/, countries/, collections/) backed by CloudFront/S3,
 * while preserving legacy local assets (/assets/reading-covers/, /assets/editorial/)
 * and absolute URLs.
 *
 * @param mediaKey Raw key or URL string
 * @param mediaBaseUrl Base URL for platform media (defaults to environment.platformMediaBaseUrl)
 * @returns Resolved browser URL or null if key is empty/invalid
 */
export function resolveMediaUrl(
  mediaKey: string | null | undefined,
  mediaBaseUrl: string = environment.platformMediaBaseUrl
): string | null {
  if (!mediaKey || typeof mediaKey !== 'string') {
    return null;
  }

  const key = mediaKey.trim();
  if (!key) {
    return null;
  }

  // 1. Absolute URLs (http:// or https://)
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  const cleanKey = key.replace(/^\/+/, '');

  // 2. Local asset paths starting with /assets/ or assets/
  if (cleanKey.startsWith('assets/')) {
    return `/${cleanKey}`;
  }

  // 3. Local editorial assets starting with editorial/
  if (cleanKey.startsWith('editorial/')) {
    return `/assets/${cleanKey}`;
  }

  // 4. Local reading covers paths starting with reading-covers/
  if (cleanKey.startsWith('reading-covers/')) {
    return `/assets/${cleanKey}`;
  }

  // 5. Platform Media keys (covers/, countries/, collections/)
  const isPlatformMedia = isPlatformMediaKey(cleanKey);
  const isPrefixedWithMedia = cleanKey.startsWith('media/') && isPlatformMediaKey(cleanKey.slice(6));

  if (isPlatformMedia || isPrefixedWithMedia) {
    const relativeKey = isPrefixedWithMedia ? cleanKey.slice(6) : cleanKey;
    const base = (mediaBaseUrl !== undefined && mediaBaseUrl !== null ? mediaBaseUrl : environment.platformMediaBaseUrl)
      .trim()
      .replace(/\/+$/, '');

    if (!base) {
      return `/${relativeKey}`;
    }
    return `${base}/${relativeKey}`;
  }

  // 6. Legacy simple cover keys (e.g. 'the-silbon', 'el-dorado', UUIDs)
  const legacyKey = /\.[a-zA-Z0-9]+$/.test(cleanKey) ? cleanKey : `${cleanKey}.webp`;
  return `/assets/reading-covers/${legacyKey}`;
}
