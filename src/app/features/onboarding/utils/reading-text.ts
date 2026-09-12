export interface ReadingTextPart {
  prefix: string;
  word: string;
  punctuation: string;
  trailingSpace: string;
  isWord: boolean;
}

export function getParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function getTextParts(text: string): ReadingTextPart[] {
  const regex = /(\s+)|(["'“‘(\[]*)([a-zA-Z0-9'’\-]+)([.,!?;:"'”’)\]]*)|([^\s]+)/g;
  let match: RegExpExecArray | null;
  const parts: ReadingTextPart[] = [];

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      if (parts.length > 0 && !parts[parts.length - 1].trailingSpace) {
        parts[parts.length - 1].trailingSpace = match[1];
      } else if (parts.length === 0) {
        parts.push({
          prefix: '',
          word: match[1],
          punctuation: '',
          trailingSpace: '',
          isWord: false,
        });
      }
    } else if (match[3]) {
      parts.push({
        prefix: match[2] || '',
        word: match[3],
        punctuation: match[4] || '',
        trailingSpace: '',
        isWord: true,
      });
    } else if (match[5]) {
      parts.push({
        prefix: '',
        word: match[5],
        punctuation: '',
        trailingSpace: '',
        isWord: false,
      });
    }
  }

  return parts;
}

export function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[.,!?;:"'”’)\]\(\[]/g, '');
}
