import { coverUrl } from './cover-url';

describe('coverUrl', () => {
  it('resolves a key to the contractual WebP asset path', () => {
    expect(coverUrl('the-camera-on-platform-three')).toBe('/assets/reading-covers/the-camera-on-platform-three.webp');
  });

  it('returns null without a usable key', () => {
    expect(coverUrl(null)).toBeNull();
    expect(coverUrl('  ')).toBeNull();
  });
});
