export function getParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function getTextParts(text: string): string[] {
  return text.split(/(\s+|[.,!?;:])/).filter((part) => part !== '');
}

export function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[.,!?;:]/g, '');
}
