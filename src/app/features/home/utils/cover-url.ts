import { resolveMediaUrl } from '../../../shared/utils/media-url';

/**
 * Centralized reading cover URL resolver.
 * Delegates to the unified platform media resolver while preserving legacy call signatures.
 */
export function resolveReadingCoverUrl(
  coverKey: string | null | undefined,
  mediaBaseUrl?: string
): string | null {
  return resolveMediaUrl(coverKey, mediaBaseUrl);
}

export const coverUrl = resolveReadingCoverUrl;
