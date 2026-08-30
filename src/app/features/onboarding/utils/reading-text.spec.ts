import { getParagraphs, getTextParts, normalizeWord } from './reading-text';

describe('reading text utilities', () => {
  it('preserves real paragraphs and removes empty blocks', () => {
    expect(getParagraphs(' First paragraph.\n\n \nSecond paragraph. ')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ]);
  });

  it('keeps spaces and punctuation as renderable text parts', () => {
    expect(getTextParts('Hello, world!')).toEqual([
      'Hello',
      ',',
      ' ',
      'world',
      '!',
    ]);
  });

  it('normalizes casing and reader punctuation', () => {
    expect(normalizeWord('Reading,')).toBe('reading');
  });
});
