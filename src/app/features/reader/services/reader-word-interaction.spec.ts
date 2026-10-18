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
  let audioInstances: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; currentTime: number; src: string }>;

  beforeEach(() => {
    lookup = vi.fn(() => of('<lookup/>'));
    parseLookup = vi.fn(() => word('remember'));
    setStatus = vi.fn(() => of('<saved/>'));
    audioInstances = [];
    class AudioMock {
      currentTime = 0;
      readonly play = vi.fn(() => Promise.resolve());
      readonly pause = vi.fn();
      constructor(readonly src: string) { audioInstances.push(this); }
    }
    vi.stubGlobal('Audio', AudioMock);
    TestBed.configureTestingModule({ providers:[ReaderWordInteraction,{provide:ReaderService,useValue:{setVocabularyStatus:setStatus}},{provide:DictionaryService,useValue:{lookupWord:lookup,parseLookupWordResponse:parseLookup}}] });
    interaction = TestBed.inject(ReaderWordInteraction);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens a selected word and exposes lookup, translation, phonetic and definitions', () => {
    interaction.selectWord(token('Remember','NEW'), wordClick());
    expect(lookup).toHaveBeenCalledWith('Remember');
    expect(interaction.dictionaryWord()).toEqual(word('remember'));
    expect(interaction.lookupLoading()).toBe(false);
    expect(interaction.popoverPosition()).not.toBeNull();
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].play).toHaveBeenCalledOnce();
  });

  it('plays once per opening, and manual audio replaces and repeats pronunciation', () => {
    interaction.selectWord(token('Remember','NEW'), wordClick());
    expect(audioInstances).toHaveLength(1);

    interaction.playAudio('audio.mp3');

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalledOnce();
    expect(audioInstances[0].currentTime).toBe(0);
    expect(audioInstances[1].play).toHaveBeenCalledOnce();
  });

  it('cancels the previous pronunciation when another word opens quickly', () => {
    parseLookup
      .mockReturnValueOnce(word('garden'))
      .mockImplementationOnce(() => word('flowers'));

    interaction.selectWord(token('garden','NEW'), wordClick());
    interaction.selectWord(token('flowers','NEW'), wordClick());

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalledOnce();
    expect(audioInstances[1].src).toBe('audio.mp3');
    expect(interaction.dictionaryWord()?.word).toBe('flowers');
  });

  it('keeps the popover and classification usable when pronunciation is unavailable', () => {
    parseLookup.mockReturnValue({ ...word('silent'), audioUrl:null });
    interaction.selectWord(token('silent',null), wordClick());

    expect(audioInstances).toHaveLength(0);
    expect(interaction.selectedToken()?.value).toBe('silent');
    interaction.setLocalStatus('KNOWN', vi.fn());
    expect(interaction.selectedStatus()).toBe('KNOWN');
  });

  it('updates local onboarding state without calling Reader vocabulary persistence', () => {
    const update = vi.fn();
    interaction.selectWord(token('Remember',null), wordClick());

    interaction.setLocalStatus('IGNORED', update);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ value:'Remember' }), 'IGNORED');
    expect(interaction.selectedStatus()).toBe('IGNORED');
    expect(setStatus).not.toHaveBeenCalled();
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
    expect(audioInstances).toHaveLength(1);
    interaction.close(); expect(interaction.selectedToken()).toBeNull();
    interaction.selectWord(token('remember','NEW'),wordClick()); interaction.reset();
    expect(interaction.selectedToken()).toBeNull(); expect(interaction.lookupLoading()).toBe(false);
  });

  describe('Audio Promise Hardening (S4822)', () => {
    it('sets audioError when play() rejects asynchronously and current request is active', async () => {
      const rejectedPromise = Promise.reject(new Error('Autoplay blocked'));
      rejectedPromise.catch(() => {});

      class RejectingAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => rejectedPromise);
        readonly pause = vi.fn();
        constructor(readonly src: string) {
          audioInstances.push(this);
        }
      }
      vi.stubGlobal('Audio', RejectingAudioMock);

      interaction.playAudio('rejected.mp3');
      await Promise.resolve();
      await Promise.resolve();

      expect(interaction.audioError()).toBe('Audio temporalmente no disponible');
    });

    it('sets audioError when play() rejects with NotSupportedError', async () => {
      const rejectedPromise = Promise.reject(new Error('NotSupportedError: format not supported'));
      rejectedPromise.catch(() => {});

      class FailingAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => rejectedPromise);
        readonly pause = vi.fn();
        constructor(readonly src: string) {
          audioInstances.push(this);
        }
      }
      vi.stubGlobal('Audio', FailingAudioMock);

      interaction.playAudio('unsupported.mp3');
      await Promise.resolve();
      await Promise.resolve();

      expect(interaction.audioError()).toBe('Audio temporalmente no disponible');
    });

    it('ignores rejection if a newer audio request has been made', async () => {
      let rejectFirst!: (err: unknown) => void;
      const firstPromise = new Promise<void>((_, reject) => {
        rejectFirst = reject;
      });
      firstPromise.catch(() => {});

      class DynamicAudioMock {
        currentTime = 0;
        readonly play: ReturnType<typeof vi.fn>;
        readonly pause = vi.fn();
        constructor(readonly src: string) {
          audioInstances.push(this);
          if (src === 'first.mp3') {
            this.play = vi.fn(() => firstPromise);
          } else {
            this.play = vi.fn(() => Promise.resolve());
          }
        }
      }
      vi.stubGlobal('Audio', DynamicAudioMock);

      interaction.playAudio('first.mp3');
      interaction.playAudio('second.mp3');

      rejectFirst(new Error('Stale request error'));
      await Promise.resolve();
      await Promise.resolve();

      expect(interaction.audioError()).toBeNull();
    });
  });

  function token(value:string,status:ReaderToken['status']):ReaderToken { return {value,normalizedValue:value.toLowerCase(),type:'WORD',status}; }
  function word(value:string) { return {word:value,normalizedWord:value,translation:'traducción',phonetic:'/test/',audioUrl:'audio.mp3',meanings:[{partOfSpeech:'noun',definitions:[{definition:'Definition',example:'Example'}]}]}; }
  function wordClick():MouseEvent { const element=document.createElement('button'); element.getBoundingClientRect=()=>({left:100,right:160,top:200,bottom:230,width:60,height:30} as DOMRect); return {stopPropagation:vi.fn(),currentTarget:element} as unknown as MouseEvent; }
});
