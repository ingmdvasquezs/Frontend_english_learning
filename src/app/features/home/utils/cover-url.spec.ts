import { coverUrl, resolveReadingCoverUrl } from './cover-url';

describe('coverUrl', () => {
  it('resolves a key to the contractual WebP asset path', () => {
    expect(coverUrl('the-camera-on-platform-three')).toBe('/assets/reading-covers/the-camera-on-platform-three.webp');
  });

  it('returns null without a usable key', () => {
    expect(coverUrl(null)).toBeNull();
    expect(coverUrl(undefined)).toBeNull();
    expect(coverUrl('  ')).toBeNull();
    expect(coverUrl('')).toBeNull();
  });

  it('preserves absolute URLs for future S3 / CloudFront CDN support', () => {
    const cdnUrl = 'https://d1wm4p27h1vrkl.cloudfront.net/covers/my-book.webp';
    expect(coverUrl(cdnUrl)).toBe(cdnUrl);
    expect(resolveReadingCoverUrl(cdnUrl)).toBe(cdnUrl);
  });

  it('resolves platform media keys with explicit or environment base URL', () => {
    expect(coverUrl('covers/CO/123.webp', '/media')).toBe('/media/covers/CO/123.webp');
    expect(resolveReadingCoverUrl('covers/CO/123.webp', '/media')).toBe('/media/covers/CO/123.webp');
  });
});
