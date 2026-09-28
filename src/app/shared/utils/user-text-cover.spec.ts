import { userTextCoverUrl } from './user-text-cover';

describe('userTextCoverUrl', () => {
  it('returns the same cover whenever the same readingId is evaluated', () => {
    const first = userTextCoverUrl('reading-a');

    expect(userTextCoverUrl('reading-a')).toBe(first);
    expect(userTextCoverUrl('reading-a')).toBe(first);
  });

  it('can distribute different readingIds across different local covers', () => {
    expect(userTextCoverUrl('reading-a')).not.toBe(userTextCoverUrl('reading-b'));
  });

  it('always resolves inside the local USER/TEXT cover directory', () => {
    expect(userTextCoverUrl('any-reading')).toMatch(
      /^\/assets\/reading-covers\/user-text\/text-cover-0[1-8]\.svg$/
    );
  });

  describe('deterministic hashing and Unicode-aware codePointAt behavior', () => {
    it('characterizes A. ASCII inputs deterministically', () => {
      expect(userTextCoverUrl('reading-a')).toBe(
        '/assets/reading-covers/user-text/text-cover-01.svg'
      );
    });

    it('characterizes B. UUID / slug normal inputs deterministically matching legacy mapping', () => {
      expect(userTextCoverUrl('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(
        '/assets/reading-covers/user-text/text-cover-04.svg'
      );
      expect(userTextCoverUrl('reading-1')).toBe(
        '/assets/reading-covers/user-text/text-cover-01.svg'
      );
    });

    it('characterizes C. Latin characters with accents (BMP) deterministically', () => {
      expect(userTextCoverUrl('canción')).toBe(
        '/assets/reading-covers/user-text/text-cover-02.svg'
      );
    });

    it('characterizes D. Astral Unicode characters (emojis) considering the full code point', () => {
      expect(userTextCoverUrl('doc-🚀')).toBe(
        '/assets/reading-covers/user-text/text-cover-04.svg'
      );
    });

    it('characterizes E. Empty string deterministically', () => {
      expect(userTextCoverUrl('')).toBe(
        '/assets/reading-covers/user-text/text-cover-01.svg'
      );
    });
  });
});
