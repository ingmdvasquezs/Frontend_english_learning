import { ReaderToken } from '../models/reader-token';
import { createNarrationTokenMap, findNarrationWordTokenIndex } from './narration-token-map';

describe('narration token map', () => {
  it.each([
    {
      name:'words and punctuation',
      tokens:[word('Hello'),space(' '),word('world'),punctuation('.')],
      text:'Hello world.',
      wordRanges:[[0,0,5],[2,6,11]],
    },
    {
      name:'contraction',
      tokens:[word("Don't"),space(' '),word('stop'),punctuation('.')],
      text:"Don't stop.",
      wordRanges:[[0,0,5],[2,6,10]],
    },
    {
      name:'curly quotes',
      tokens:[word('He'),space(' '),word('said'),punctuation(','),space(' '),punctuation('“'),word('hello'),punctuation('.”')],
      text:'He said, “hello.”',
      wordRanges:[[0,0,2],[2,3,7],[6,10,15]],
    },
    {
      name:'em dash',
      tokens:[word('wait'),punctuation('—'),word('listen')],
      text:'wait—listen',
      wordRanges:[[0,0,4],[2,5,11]],
    },
    {
      name:'multiple spaces and paragraphs',
      tokens:[word('One'),space('   '),word('two'),space('\n\n'),word('Three')],
      text:'One   two\n\nThree',
      wordRanges:[[0,0,3],[2,6,9],[4,11,16]],
    },
  ])('preserves exact offsets for $name', ({tokens,text,wordRanges}) => {
    const map=createNarrationTokenMap(tokens);
    expect(map.text).toBe(text);
    expect(map.ranges.filter((range)=>range.type==='WORD').map((range)=>[range.tokenIndex,range.start,range.end])).toEqual(wordRanges);
    for (const [tokenIndex,start] of wordRanges) expect(findNarrationWordTokenIndex(map.ranges,start)).toBe(tokenIndex);
  });

  it('skips spacing and punctuation to select the following WORD token', () => {
    const map=createNarrationTokenMap([
      word('He'),space(' '),word('said'),punctuation(','),space(' '),punctuation('“'),word('hello'),punctuation('.”'),
    ]);
    expect(findNarrationWordTokenIndex(map.ranges,7)).toBe(6);
    expect(findNarrationWordTokenIndex(map.ranges,9)).toBe(6);
    expect(findNarrationWordTokenIndex(map.ranges,16)).toBeNull();
  });

  it('maps whitespace and punctuation boundaries to the following word', () => {
    const map=createNarrationTokenMap([word('Hello'),punctuation(','),space('  '),word('world'),punctuation('.')]);
    expect(findNarrationWordTokenIndex(map.ranges,5)).toBe(3);
    expect(findNarrationWordTokenIndex(map.ranges,7)).toBe(3);
    expect(findNarrationWordTokenIndex(map.ranges,13)).toBeNull();
  });

  function word(value:string):ReaderToken { return {value,normalizedValue:value.toLowerCase(),type:'WORD',status:null}; }
  function space(value:string):ReaderToken { return {value,normalizedValue:null,type:'WHITESPACE',status:null}; }
  function punctuation(value:string):ReaderToken { return {value,normalizedValue:null,type:'PUNCTUATION',status:null}; }
});
