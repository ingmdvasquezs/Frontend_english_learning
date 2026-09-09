const USER_TEXT_COVERS = [
  '/assets/reading-covers/user-text/text-cover-01.svg',
  '/assets/reading-covers/user-text/text-cover-02.svg',
  '/assets/reading-covers/user-text/text-cover-03.svg',
] as const;

export function userTextCoverUrl(readingId: string): string {
  const hash = Array.from(readingId).reduce(
    (value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0,
    0
  );

  return USER_TEXT_COVERS[hash % USER_TEXT_COVERS.length];
}
