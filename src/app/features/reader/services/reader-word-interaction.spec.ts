import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DictionaryService } from '../../../shared/services/dictionary';
import { ReaderToken } from '../models/reader.models';
import { ReaderService } from './reader';
import { ReaderWordInteraction } from './reader-word-interaction';

describe('ReaderWordInteraction', () => {
  let interaction: ReaderWordInteraction;
  let lookup: ReturnType<typeof vi.fn>;
  let parseLookup: ReturnType<typeof vi.fn>;
  let setStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    lookup = vi.fn(() => of('<lookup/>'));
    parseLookup = vi.fn(() => word('remember'));
    setStatus = vi.fn(() => of('<saved/>'));
    TestBed.configureTestingModule({ providers:[ReaderWordInteraction,{provide:ReaderService,useValue:{setVocabularyStatus:setStatus}},{provide:DictionaryService,useValue:{lookupWord:lookup,parseLookupWordResponse:parseLookup}}] });
    interaction = TestBed.inject(ReaderWordInteraction);
  });

  it('opens a selected word and exposes lookup, translation, phonetic and definitions', () => {
    interaction.selectWord(token('Remember','NEW'), wordClick());
    expect(lookup).toHaveBeenCalledWith('Remember');
    expect(interaction.dictionaryWord()).toEqual(word('remember'));
    expect(interaction.lookupLoading()).toBe(false);
    expect(interaction.popoverPosition()).not.toBeNull();
  });

  it('supports repeated status transitions through the shared SOAP service', () => {
    interaction.selectWord(token('Remember','NEW'), wordClick());
    const applied:string[]=[];
    for (const status of ['LEARNING','KNOWN','IGNORED','NEW'] as const) {
      interaction.saveStatus(status,'en',(_selected,next)=>applied.push(next));
      expect(interaction.selectedStatus()).toBe(status);
      expect(interaction.savingStatus()).toBe(false);
    }
    expect(applied).toEqual(['LEARNING','KNOWN','IGNORED','NEW']);
    expect(setStatus).toHaveBeenCalledTimes(4);
  });

  it('shows saving while pending and always releases it after success', () => {
    const response=new Subject<string>(); setStatus.mockReturnValue(response);
    interaction.selectWord(token('Remember','NEW'), wordClick());
    const update=vi.fn(); interaction.saveStatus('KNOWN','en',update);
    expect(interaction.savingStatus()).toBe(true);
    response.next('<saved/>');
    expect(update).toHaveBeenCalledOnce();
    expect(interaction.selectedStatus()).toBe('KNOWN');
    expect(interaction.savingStatus()).toBe(false);
  });

  it('releases saving and allows retry after asynchronous or synchronous mutation failure', () => {
    setStatus.mockReturnValueOnce(throwError(() => new Error('SOAP'))).mockImplementationOnce(() => { throw new Error('missing token'); }).mockReturnValueOnce(of('<saved/>'));
    interaction.selectWord(token('Remember','NEW'), wordClick());
    interaction.saveStatus('KNOWN','en',vi.fn());
    expect(interaction.savingStatus()).toBe(false); expect(interaction.statusError()).toContain('No pudimos actualizar');
    interaction.saveStatus('LEARNING','en',vi.fn());
    expect(interaction.savingStatus()).toBe(false); expect(interaction.statusError()).toContain('No pudimos actualizar');
    interaction.saveStatus('IGNORED','en',vi.fn());
    expect(interaction.selectedStatus()).toBe('IGNORED'); expect(setStatus).toHaveBeenCalledTimes(3);
  });

  it('ignores stale lookup responses and clears selection on close or forced reset', () => {
    const a=new Subject<string>(); const b=new Subject<string>();
    lookup.mockReturnValueOnce(a).mockReturnValueOnce(b);
    parseLookup.mockImplementation((value:string)=>word(value));
    interaction.selectWord(token('remember','NEW'),wordClick());
    interaction.selectWord(token('brother','KNOWN'),wordClick());
    b.next('brother'); a.next('remember');
    expect(interaction.dictionaryWord()?.word).toBe('brother');
    interaction.close(); expect(interaction.selectedToken()).toBeNull();
    interaction.selectWord(token('remember','NEW'),wordClick()); interaction.reset();
    expect(interaction.selectedToken()).toBeNull(); expect(interaction.lookupLoading()).toBe(false);
  });

  function token(value:string,status:ReaderToken['status']):ReaderToken { return {value,normalizedValue:value.toLowerCase(),type:'WORD',status}; }
  function word(value:string) { return {word:value,normalizedWord:value,translation:'traducción',phonetic:'/test/',audioUrl:'audio.mp3',meanings:[{partOfSpeech:'noun',definitions:[{definition:'Definition',example:'Example'}]}]}; }
  function wordClick():MouseEvent { const element=document.createElement('button'); element.getBoundingClientRect=()=>({left:100,right:160,top:200,bottom:230,width:60,height:30} as DOMRect); return {stopPropagation:vi.fn(),currentTarget:element} as unknown as MouseEvent; }
});
