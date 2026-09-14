export function coverUrl(coverKey: string | null | undefined): string | null {
  const key = coverKey?.trim();
  return key ? `/assets/reading-covers/${key}.webp` : null;
}
