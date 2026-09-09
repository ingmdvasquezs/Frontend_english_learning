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
      /^\/assets\/reading-covers\/user-text\/text-cover-0[1-3]\.svg$/
    );
  });
});
