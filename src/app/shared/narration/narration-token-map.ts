import { ReaderToken } from '../../features/reader/models/reader.models';

export interface NarrationTokenRange {
  readonly tokenIndex: number;
  readonly start: number;
  readonly end: number;
  readonly type: ReaderToken['type'];
}

export interface NarrationTokenMap {
  readonly text: string;
  readonly ranges: readonly NarrationTokenRange[];
}

export function createNarrationTokenMap(tokens: readonly ReaderToken[]): NarrationTokenMap {
  let offset = 0;
  const textParts: string[] = [];
  const ranges = tokens.map((token, tokenIndex) => {
    const range: NarrationTokenRange = {
      tokenIndex,
      start: offset,
      end: offset + token.value.length,
      type: token.type,
    };
    textParts.push(token.value);
    offset = range.end;
    return range;
  });
  return { text:textParts.join(''), ranges };
}

export function findNarrationWordTokenIndex(
  ranges: readonly NarrationTokenRange[],
  characterIndex: number | null
): number | null {
  if (characterIndex === null || !Number.isFinite(characterIndex) || characterIndex < 0) return null;

  const containingWord = ranges.find(
    (range) => range.type === 'WORD' && characterIndex >= range.start && characterIndex < range.end
  );
  if (containingWord) return containingWord.tokenIndex;

  return ranges.find((range) => range.type === 'WORD' && range.start >= characterIndex)?.tokenIndex ?? null;
}
