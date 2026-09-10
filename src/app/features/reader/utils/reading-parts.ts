import { ReaderToken } from '../models/reader.models';

export const TEXT_PART_TARGET_WORDS = 160;
export const TEXT_PART_MINIMUM_WORDS = 100;
export const TEXT_PART_MAXIMUM_WORDS = 220;
export const TEXT_PART_HARD_WORDS = 260;
export const TEXT_PAGINATION_VERSION = 1;

export interface ReadingPart {
  ordinal: number;
  totalParts: number;
  tokens: readonly ReaderToken[];
  text: string;
  wordCount: number;
}

interface TokenRange {
  start: number;
  end: number;
  wordCount: number;
}

export function createReadingParts(tokens: readonly ReaderToken[]): ReadingPart[] {
  if (tokens.length === 0) return [];

  const totalWords = countWords(tokens, 0, tokens.length);
  if (totalWords <= TEXT_PART_MAXIMUM_WORDS) return toParts(tokens, [{ start: 0, end: tokens.length, wordCount: totalWords }]);

  const chunks = paragraphRanges(tokens).flatMap((paragraph) =>
    paragraph.wordCount > TEXT_PART_HARD_WORDS ? splitLongParagraph(tokens, paragraph) : [paragraph]
  );
  const grouped: TokenRange[] = [];
  let current: TokenRange | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    const combinedWords = current.wordCount + chunk.wordCount;
    const combinedIsBetter =
      combinedWords <= TEXT_PART_MAXIMUM_WORDS &&
      (current.wordCount < TEXT_PART_MINIMUM_WORDS ||
        Math.abs(TEXT_PART_TARGET_WORDS - combinedWords) <= Math.abs(TEXT_PART_TARGET_WORDS - current.wordCount));

    if (combinedIsBetter) {
      current.end = chunk.end;
      current.wordCount = combinedWords;
    } else {
      grouped.push(current);
      current = { ...chunk };
    }
  }
  if (current) grouped.push(current);

  mergeSmallFinalPart(grouped);
  return toParts(tokens, grouped);
}

function paragraphRanges(tokens: readonly ReaderToken[]): TokenRange[] {
  const ranges: TokenRange[] = [];
  let start = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type === 'WHITESPACE' && /(?:\r?\n)[\t ]*(?:\r?\n)/u.test(tokens[index].value)) {
      ranges.push(range(tokens, start, index + 1));
      start = index + 1;
    }
  }
  if (start < tokens.length) ranges.push(range(tokens, start, tokens.length));
  return ranges;
}

function splitLongParagraph(tokens: readonly ReaderToken[], paragraph: TokenRange): TokenRange[] {
  const sentences = sentenceRanges(tokens, paragraph);
  const atomic = sentences.flatMap((sentence) =>
    sentence.wordCount > TEXT_PART_HARD_WORDS ? splitRangeByWords(tokens, sentence) : [sentence]
  );
  const result: TokenRange[] = [];
  let current: TokenRange | null = null;

  for (const sentence of atomic) {
    if (!current) {
      current = { ...sentence };
      continue;
    }
    const combined = current.wordCount + sentence.wordCount;
    if (combined <= TEXT_PART_MAXIMUM_WORDS && (current.wordCount < TEXT_PART_MINIMUM_WORDS || combined <= TEXT_PART_TARGET_WORDS)) {
      current.end = sentence.end;
      current.wordCount = combined;
    } else {
      result.push(current);
      current = { ...sentence };
    }
  }
  if (current) result.push(current);
  return result;
}

function sentenceRanges(tokens: readonly ReaderToken[], source: TokenRange): TokenRange[] {
  const ranges: TokenRange[] = [];
  let start = source.start;
  let index = source.start;
  while (index < source.end) {
    const token = tokens[index];
    if (token.type === 'PUNCTUATION' && /[.!?](?:["'\u2019\u201d)\]])*$/u.test(token.value)) {
      let end = index + 1;
      while (end < source.end && tokens[end].type === 'WHITESPACE') end += 1;
      ranges.push(range(tokens, start, end));
      start = end;
      index = end;
    } else {
      index += 1;
    }
  }
  if (start < source.end) ranges.push(range(tokens, start, source.end));
  return ranges.length > 0 ? ranges : [source];
}

function splitRangeByWords(tokens: readonly ReaderToken[], source: TokenRange): TokenRange[] {
  const partCount = Math.max(2, Math.ceil(source.wordCount / TEXT_PART_TARGET_WORDS));
  const baseWords = Math.floor(source.wordCount / partCount);
  const extra = source.wordCount % partCount;
  const targets = Array.from({ length: partCount }, (_, index) => baseWords + (index < extra ? 1 : 0));
  const ranges: TokenRange[] = [];
  let start = source.start;
  let words = 0;
  let targetIndex = 0;

  for (let index = source.start; index < source.end && targetIndex < targets.length - 1; index += 1) {
    if (tokens[index].type === 'WORD') words += 1;
    if (words !== targets[targetIndex]) continue;

    let end = index + 1;
    while (end < source.end && tokens[end].type !== 'WORD') end += 1;
    ranges.push(range(tokens, start, end));
    start = end;
    words = 0;
    targetIndex += 1;
  }
  ranges.push(range(tokens, start, source.end));
  return ranges;
}

function mergeSmallFinalPart(ranges: TokenRange[]): void {
  if (ranges.length < 2) return;
  const last = ranges.at(-1)!;
  const previous = ranges.at(-2)!;
  if (last.wordCount < TEXT_PART_MINIMUM_WORDS && previous.wordCount + last.wordCount <= TEXT_PART_MAXIMUM_WORDS) {
    previous.end = last.end;
    previous.wordCount += last.wordCount;
    ranges.pop();
  }
}

function range(tokens: readonly ReaderToken[], start: number, end: number): TokenRange {
  return { start, end, wordCount: countWords(tokens, start, end) };
}

function countWords(tokens: readonly ReaderToken[], start: number, end: number): number {
  let count = 0;
  for (let index = start; index < end; index += 1) if (tokens[index].type === 'WORD') count += 1;
  return count;
}

function toParts(tokens: readonly ReaderToken[], ranges: readonly TokenRange[]): ReadingPart[] {
  return ranges.map((item, index) => {
    const partTokens = tokens.slice(item.start, item.end);
    return {
      ordinal: index + 1,
      totalParts: ranges.length,
      tokens: partTokens,
      text: partTokens.map((token) => token.value).join(''),
      wordCount: item.wordCount,
    };
  });
}
