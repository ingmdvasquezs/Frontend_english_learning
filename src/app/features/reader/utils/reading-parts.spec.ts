import { ReaderToken } from '../models/reader.models';
import {
  TEXT_PART_HARD_WORDS,
  TEXT_PART_MAXIMUM_WORDS,
  createReadingParts,
} from './reading-parts';

describe('createReadingParts', () => {
  it('keeps a short reading as one exact Part', () => {
    const tokens = tokenize('A short reading — with “quotes”, contractions don\'t break, and  multiple spaces.');
    const parts = createReadingParts(tokens);
    expect(parts).toHaveLength(1);
    expect(parts[0].ordinal).toBe(1);
    expect(parts[0].totalParts).toBe(1);
    expect(parts[0].text).toBe(tokens.map((token) => token.value).join(''));
  });

  it('groups complete paragraphs into stable Parts near the target', () => {
    const text = [paragraph(90, 'One'), paragraph(80, 'Two'), paragraph(110, 'Three')].join('\n\n');
    const tokens = tokenize(text);
    const first = createReadingParts(tokens);
    const second = createReadingParts(tokens);
    expect(first.map((part) => part.wordCount)).toEqual([170, 110]);
    expect(first.map((part) => part.text)).toEqual(second.map((part) => part.text));
    expect(first[0].text).toContain('\n\n');
    expect(exactText(first)).toBe(text);
    expect(exactTokens(first)).toEqual(tokens);
  });

  it('splits a paragraph over HARD by sentences without losing punctuation or Unicode', () => {
    const text = `${sentence(90, 'Alpha')} ${sentence(90, 'Beta')} ${sentence(90, 'Gamma')}`;
    const parts = createReadingParts(tokenize(text));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.wordCount <= TEXT_PART_MAXIMUM_WORDS)).toBe(true);
    expect(exactText(parts)).toBe(text);
  });

  it('splits one sentence over HARD by words and retains every token once', () => {
    const text = `${Array.from({ length: TEXT_PART_HARD_WORDS + 61 }, (_, index) => `word${index}`).join(' ')} — don\'t stop!`;
    const tokens = tokenize(text);
    const parts = createReadingParts(tokens);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.wordCount <= TEXT_PART_MAXIMUM_WORDS)).toBe(true);
    expect(exactText(parts)).toBe(text);
    expect(exactTokens(parts)).toEqual(tokens);
  });

  it('does not derive different boundaries from viewport dimensions', () => {
    const tokens = tokenize([paragraph(120, 'Desktop'), paragraph(120, 'Mobile')].join('\n\n'));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    const mobile = createReadingParts(tokens).map((part) => part.text);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    expect(createReadingParts(tokens).map((part) => part.text)).toEqual(mobile);
  });

  function paragraph(words: number, prefix: string): string {
    return `${Array.from({ length: words }, (_, index) => `${prefix}${index}`).join(' ')}.`;
  }

  function sentence(words: number, prefix: string): string {
    return `${Array.from({ length: words }, (_, index) => `${prefix}${index}`).join(' ')}!`;
  }

  function tokenize(text: string): ReaderToken[] {
    return Array.from(text.matchAll(/[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*|\s+|[^\p{L}\p{N}\s]+/gu), (match) => ({
      value: match[0],
      normalizedValue: /[\p{L}\p{N}]/u.test(match[0]) && !/^\s+$/u.test(match[0]) ? match[0].toLocaleLowerCase() : null,
      type: /^\s+$/u.test(match[0]) ? 'WHITESPACE' : /^[\p{L}\p{N}]/u.test(match[0]) ? 'WORD' : 'PUNCTUATION',
      status: null,
    }));
  }

  function exactText(parts: ReturnType<typeof createReadingParts>): string {
    return parts.map((part) => part.text).join('');
  }

  function exactTokens(parts: ReturnType<typeof createReadingParts>): readonly ReaderToken[] {
    return parts.flatMap((part) => part.tokens);
  }
});
