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

  it('characterizes tokenization for contractions, hyphens, and quotes', () => {
    const contractions = getTextParts("don't it's I'd");
    expect(contractions.map((p) => p.word)).toEqual(["don't", "it's", "I'd"]);
    expect(contractions.every((p) => p.isWord)).toBe(true);

    const hyphenated = getTextParts('well-known');
    expect(hyphenated).toEqual([
      { prefix: '', word: 'well-known', punctuation: '', trailingSpace: '', isWord: true },
    ]);

    const quoted = getTextParts('"hello" (world) [reading]');
    expect(quoted).toEqual([
      { prefix: '"', word: 'hello', punctuation: '"', trailingSpace: ' ', isWord: true },
      { prefix: '(', word: 'world', punctuation: ')', trailingSpace: ' ', isWord: true },
      { prefix: '[', word: 'reading', punctuation: ']', trailingSpace: '', isWord: true },
    ]);
  });

  it('characterizes Unicode quotes and punctuation boundaries', () => {
    const doubleSmart = getTextParts('“hello”');
    expect(doubleSmart).toEqual([
      { prefix: '“', word: 'hello', punctuation: '”', trailingSpace: '', isWord: true },
    ]);

    const singleSmart = getTextParts('‘hello’');
    expect(singleSmart).toEqual([
      { prefix: '‘', word: 'hello’', punctuation: '', trailingSpace: '', isWord: true },
    ]);

    const inverted = getTextParts('¿hello?');
    expect(inverted).toEqual([
      { prefix: '', word: '¿hello?', punctuation: '', trailingSpace: '', isWord: false },
    ]);

    const standalonePunct = getTextParts('... ?! ---');
    expect(standalonePunct).toEqual([
      { prefix: '', word: '...', punctuation: '', trailingSpace: ' ', isWord: false },
      { prefix: '', word: '?!', punctuation: '', trailingSpace: ' ', isWord: false },
      { prefix: '', word: '---', punctuation: '', trailingSpace: '', isWord: true },
    ]);
  });

  it('characterizes whitespace handling across tabs, newlines, and leading spaces', () => {
    const whitespace = getTextParts('  first\tsecond\nthird  ');
    expect(whitespace).toEqual([
      { prefix: '', word: '  ', punctuation: '', trailingSpace: '', isWord: false },
      { prefix: '', word: 'first', punctuation: '', trailingSpace: '\t', isWord: true },
      { prefix: '', word: 'second', punctuation: '', trailingSpace: '\n', isWord: true },
      { prefix: '', word: 'third', punctuation: '', trailingSpace: '  ', isWord: true },
    ]);
  });
});

