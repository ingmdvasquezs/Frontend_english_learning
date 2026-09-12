import { getParagraphs, getTextParts, normalizeWord } from './reading-text';

describe('reading text utilities', () => {
  it('preserves real paragraphs and removes empty blocks', () => {
    expect(getParagraphs(' First paragraph.\n\n \nSecond paragraph. ')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ]);
  });

  it('keeps punctuation attached to words without leading spaces and preserves trailing spaces', () => {
    const parts = getTextParts('Hello, world! Welcome to the market.');
    expect(parts).toEqual([
      { prefix: '', word: 'Hello', punctuation: ',', trailingSpace: ' ', isWord: true },
      { prefix: '', word: 'world', punctuation: '!', trailingSpace: ' ', isWord: true },
      { prefix: '', word: 'Welcome', punctuation: '', trailingSpace: ' ', isWord: true },
      { prefix: '', word: 'to', punctuation: '', trailingSpace: ' ', isWord: true },
      { prefix: '', word: 'the', punctuation: '', trailingSpace: ' ', isWord: true },
      { prefix: '', word: 'market', punctuation: '.', trailingSpace: '', isWord: true },
    ]);
  });

  it('reconstructs text identically without spaces before punctuation', () => {
    const text = 'In early autumn, the capital market was busy. Work, focus, and patience!';
    const parts = getTextParts(text);
    const reconstructed = parts
      .map((p) => (p.prefix || '') + p.word + (p.punctuation || '') + (p.trailingSpace || ''))
      .join('');
    expect(reconstructed).toBe(text);
    expect(/\s[.,!?;:]/.test(reconstructed)).toBe(false);
  });

  it('normalizes casing and reader punctuation', () => {
    expect(normalizeWord('Reading,')).toBe('reading');
    expect(normalizeWord('\"Market.\"')).toBe('market');
  });
});
