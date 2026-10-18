import { describe, it, expect } from 'vitest';
import { environment } from '../../../environments/environment';
import { isPlatformMediaKey, resolveMediaUrl } from './media-url';

describe('resolveMediaUrl', () => {
  describe('9 contractual test cases from Phase 18.3C specification', () => {
    it('1. returns null for null', () => {
      expect(resolveMediaUrl(null)).toBeNull();
    });

    it('2. returns null for empty string', () => {
      expect(resolveMediaUrl('')).toBeNull();
    });

    it('3. resolves legacy-key to /assets/reading-covers/legacy-key.webp', () => {
      expect(resolveMediaUrl('legacy-key')).toBe('/assets/reading-covers/legacy-key.webp');
    });

    it('4. preserves local asset path starting with /assets/foo.webp', () => {
      expect(resolveMediaUrl('/assets/foo.webp')).toBe('/assets/foo.webp');
    });

    it('5. normalizes local asset path starting with assets/foo.webp to /assets/foo.webp', () => {
      expect(resolveMediaUrl('assets/foo.webp')).toBe('/assets/foo.webp');
    });

    it('6. preserves absolute URL https://example.com/foo.webp', () => {
      expect(resolveMediaUrl('https://example.com/foo.webp')).toBe('https://example.com/foo.webp');
    });

    it('7. resolves covers/CO/123.webp using configured media base URL', () => {
      expect(resolveMediaUrl('covers/CO/123.webp')).toBe(
        `${environment.platformMediaBaseUrl}/covers/CO/123.webp`
      );
    });

    it('8. resolves countries/MX/hero.webp using configured media base URL', () => {
      expect(resolveMediaUrl('countries/MX/hero.webp')).toBe(
        `${environment.platformMediaBaseUrl}/countries/MX/hero.webp`
      );
    });

    it('9. resolves collections/movies-and-cinema/hero.webp using configured media base URL', () => {
      expect(resolveMediaUrl('collections/movies-and-cinema/hero.webp')).toBe(
        `${environment.platformMediaBaseUrl}/collections/movies-and-cinema/hero.webp`
      );
    });
  });

  describe('production same-origin resolution (/media)', () => {
    const prodMediaBase = '/media';

    it('resolves covers with production same-origin base', () => {
      expect(resolveMediaUrl('covers/CO/123.webp', prodMediaBase)).toBe(
        '/media/covers/CO/123.webp'
      );
    });

    it('resolves countries with production same-origin base', () => {
      expect(resolveMediaUrl('countries/MX/hero.webp', prodMediaBase)).toBe(
        '/media/countries/MX/hero.webp'
      );
    });

    it('resolves collections with production same-origin base', () => {
      expect(resolveMediaUrl('collections/movies-and-cinema/hero.webp', prodMediaBase)).toBe(
        '/media/collections/movies-and-cinema/hero.webp'
      );
    });
  });

  describe('edge cases and normalization', () => {
    it('returns null for undefined, whitespace-only or non-string inputs', () => {
      expect(resolveMediaUrl(undefined)).toBeNull();
      expect(resolveMediaUrl('   ')).toBeNull();
      expect(resolveMediaUrl(123 as unknown as string)).toBeNull();
    });

    it('preserves http:// absolute URLs', () => {
      expect(resolveMediaUrl('http://example.com/cover.jpg')).toBe('http://example.com/cover.jpg');
    });

    it('handles leading slashes in platform media keys', () => {
      expect(resolveMediaUrl('/covers/CO/123.webp', '/media')).toBe('/media/covers/CO/123.webp');
      expect(resolveMediaUrl('/countries/MX/hero.webp', '/media')).toBe('/media/countries/MX/hero.webp');
      expect(resolveMediaUrl('/collections/latin-america/hero.webp', '/media')).toBe(
        '/media/collections/latin-america/hero.webp'
      );
    });

    it('handles media/ or /media/ prefix in key gracefully', () => {
      expect(resolveMediaUrl('media/covers/CO/123.webp', '/media')).toBe('/media/covers/CO/123.webp');
      expect(resolveMediaUrl('/media/covers/CO/123.webp', '/media')).toBe('/media/covers/CO/123.webp');
    });

    it('resolves editorial/ local assets to /assets/editorial/', () => {
      expect(resolveMediaUrl('editorial/heroes/hero-latam-colombia-valle-de-cocora.webp')).toBe(
        '/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp'
      );
      expect(resolveMediaUrl('/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp')).toBe(
        '/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp'
      );
    });

    it('preserves existing extension on legacy keys without duplicating .webp', () => {
      expect(resolveMediaUrl('the-silbon.webp')).toBe('/assets/reading-covers/the-silbon.webp');
      expect(resolveMediaUrl('the-silbon')).toBe('/assets/reading-covers/the-silbon.webp');
    });

    it('trims trailing slash from custom mediaBaseUrl', () => {
      expect(resolveMediaUrl('covers/CO/123.webp', '/media/')).toBe('/media/covers/CO/123.webp');
    });
  });

  describe('isPlatformMediaKey', () => {
    it('identifies platform media prefixes', () => {
      expect(isPlatformMediaKey('covers/CO/123.webp')).toBe(true);
      expect(isPlatformMediaKey('countries/MX/hero.webp')).toBe(true);
      expect(isPlatformMediaKey('collections/scifi/hero.webp')).toBe(true);
      expect(isPlatformMediaKey('the-silbon')).toBe(false);
      expect(isPlatformMediaKey('assets/hero.webp')).toBe(false);
      expect(isPlatformMediaKey('editorial/heroes/hero.webp')).toBe(false);
    });
  });
});
