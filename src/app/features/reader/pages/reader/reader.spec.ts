import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { DictionaryService, DictionaryWord } from '../../../../shared/services/dictionary';
import { ReaderData } from '../../models/reader.models';
import { ReaderService } from '../../services/reader';
import { Reader } from './reader';

describe('Reader page', () => {
  let fixture: ComponentFixture<Reader>;
  let component: Reader;
  let loadResponse: Subject<string>;
  let statusResponse: Subject<string>;
  let completionResponse: Subject<string>;
  let lookupResponse: Subject<string>;
  let service: {
    getReaderData: ReturnType<typeof vi.fn>;
    parseReaderData: ReturnType<typeof vi.fn>;
    setVocabularyStatus: ReturnType<typeof vi.fn>;
    completeReading: ReturnType<typeof vi.fn>;
    parseCompleteReading: ReturnType<typeof vi.fn>;
  };
  let dictionaryService: {
    lookupWord: ReturnType<typeof vi.fn>;
    parseLookupWordResponse: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    loadResponse = new Subject<string>();
    statusResponse = new Subject<string>();
    completionResponse = new Subject<string>();
    lookupResponse = new Subject<string>();
    service = {
      getReaderData: vi.fn(() => loadResponse.asObservable()),
      parseReaderData: vi.fn(() => readerData()),
      setVocabularyStatus: vi.fn(() => statusResponse.asObservable()),
      completeReading: vi.fn(() => completionResponse.asObservable()),
      parseCompleteReading: vi.fn(() => ({ readingId: 'reading-1', status: 'COMPLETED', startedAt: '2026-08-30T10:00:00Z', completedAt: '2026-08-30T10:10:00Z' })),
    };
    dictionaryService = {
      lookupWord: vi.fn(() => lookupResponse.asObservable()),
      parseLookupWordResponse: vi.fn(() => dictionaryWord()),
    };

    await TestBed.configureTestingModule({
      imports: [Reader],
      providers: [
        provideRouter([]),
        { provide: ReaderService, useValue: service },
        { provide: DictionaryService, useValue: dictionaryService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ readingId: 'reading-1' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Reader);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads reader data once and preserves rendered token order', () => {
    fixture.detectChanges();
    expect(service.getReaderData).toHaveBeenCalledOnce();
    expect(service.getReaderData).toHaveBeenCalledWith('reading-1');

    loadResponse.next('<response/>');
    fixture.detectChanges();

    const tokenElements = Array.from(
      fixture.nativeElement.querySelectorAll('article button, article span') as
        NodeListOf<HTMLElement>
    );
    expect(tokenElements.map((element) => element.textContent).join('')).toBe(
      'Learning, learning! Algorithms'
    );
  });

  it('completes exactly once, disables duplicate submission and updates locally', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();
    component.completeReading();
    component.completeReading();
    expect(service.completeReading).toHaveBeenCalledOnce();
    expect(component.completingReading()).toBe(true);
    completionResponse.next('<complete/>');
    fixture.detectChanges();
    expect(component.readerData()?.progressStatus).toBe('COMPLETED');
    expect(component.completingReading()).toBe(false);
    expect(service.getReaderData).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Lectura terminada');
    expect(fixture.nativeElement.textContent).not.toContain('Terminar lectura');
  });

  it('keeps IN_PROGRESS and re-enables completion after an error', () => {
    service.completeReading.mockReturnValue(throwError(() => new Error('SOAP')));
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.completeReading();
    fixture.detectChanges();
    expect(component.readerData()?.progressStatus).toBe('IN_PROGRESS');
    expect(component.completingReading()).toBe(false);
    expect(component.completionError()).toContain('No pudimos marcar');
  });

  it('does not offer completion for initially completed reading and keeps words interactive', () => {
    service.parseReaderData.mockReturnValue({ ...readerData(), progressStatus: 'COMPLETED' });
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Terminar lectura');
    (fixture.nativeElement.querySelector('article button') as HTMLButtonElement).click();
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
    component.saveStatus('KNOWN');
    statusResponse.next('<response/>');
    expect(service.setVocabularyStatus).toHaveBeenCalledOnce();
    expect(component.readerData()?.progressStatus).toBe('COMPLETED');
  });

  it('renders null and explicit NEW blue while keeping selector semantics distinct', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();
    const words = fixture.nativeElement.querySelectorAll('article button') as
      NodeListOf<HTMLButtonElement>;

    expect(words[0].className).toContain('bg-[#29445a]');
    expect(words[1].className).toContain('bg-[#29445a]');

    words[0].click();
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll(
      'aside button[aria-pressed]'
    ) as NodeListOf<HTMLButtonElement>;
    expect(
      Array.from(options).every(
        (option) => option.getAttribute('aria-pressed') === 'false'
      )
    ).toBe(true);

    component.closeSelector();
    words[1].click();
    fixture.detectChanges();
    const newOption = fixture.nativeElement.querySelector(
      'aside button[aria-pressed="true"]'
    ) as HTMLButtonElement;
    expect(newOption.textContent?.trim()).toBe('NEW');
  });

  it('opens selector only for WORD tokens', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();

    const punctuation = fixture.nativeElement.querySelector(
      'article span'
    ) as HTMLSpanElement;
    punctuation.click();
    expect(component.selectedToken()).toBeNull();

    const whitespace = fixture.nativeElement.querySelectorAll(
      'article span'
    )[1] as HTMLSpanElement;
    whitespace.click();
    expect(component.selectedToken()).toBeNull();

    const word = fixture.nativeElement.querySelector(
      'article button'
    ) as HTMLButtonElement;
    word.click();
    expect(component.selectedToken()?.value).toBe('Learning');
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
  });

  it('sends one request and updates all normalized occurrences only after success', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.selectWord(component.readerData()!.tokens[0], wordClick());

    component.saveStatus('LEARNING');
    component.saveStatus('KNOWN');

    expect(service.setVocabularyStatus).toHaveBeenCalledOnce();
    expect(service.setVocabularyStatus).toHaveBeenCalledWith(
      'Learning',
      'en',
      'LEARNING'
    );
    expect(component.readerData()!.tokens[0].status).toBeNull();
    expect(component.readerData()!.tokens[3].status).toBe('NEW');

    statusResponse.next('<response/>');

    expect(component.readerData()!.tokens[0].status).toBe('LEARNING');
    expect(component.readerData()!.tokens[3].status).toBe('LEARNING');
    expect(service.getReaderData).toHaveBeenCalledOnce();
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
  });

  it('keeps previous statuses and shows a localized error when saving fails', () => {
    service.setVocabularyStatus.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.selectWord(component.readerData()!.tokens[0], wordClick());

    component.saveStatus('KNOWN');
    fixture.detectChanges();

    expect(component.readerData()!.tokens[0].status).toBeNull();
    expect(component.readerData()!.tokens[3].status).toBe('NEW');
    expect(component.statusError()).toContain('No pudimos actualizar');
    expect(fixture.nativeElement.textContent).toContain(
      'No pudimos actualizar esta palabra'
    );
  });

  it('shows a safe page error when reader-data fails', () => {
    service.getReaderData.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );

    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('No pudimos cargar esta lectura.');
    expect(fixture.nativeElement.textContent).toContain(
      'No pudimos cargar esta lectura'
    );
  });

  it('opens immediately and shows lexical data when lookup succeeds', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();
    const word = fixture.nativeElement.querySelector(
      'article button'
    ) as HTMLButtonElement;

    word.click();
    fixture.detectChanges();

    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Learning');
    expect(fixture.nativeElement.textContent).toContain('Buscando definición');

    lookupResponse.next('<lookup/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('/ˈlɜː.nɪŋ/');
    expect(fixture.nativeElement.textContent).toContain('aprendizaje');
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-label="Escuchar pronunciación"]'
      )
    ).toBeTruthy();

    const definitionsButton = fixture.nativeElement.querySelector(
      'button[aria-expanded="false"]'
    ) as HTMLButtonElement;
    definitionsButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('noun');
    expect(fixture.nativeElement.textContent).toContain('The act of learning');
    expect(fixture.nativeElement.textContent).toContain('Learning takes time.');
  });

  it('shows dictionary failure without closing or blocking vocabulary status', () => {
    dictionaryService.lookupWord.mockReturnValue(
      throwError(() => new Error('WORD_NOT_FOUND'))
    );
    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();
    const word = fixture.nativeElement.querySelector(
      'article button'
    ) as HTMLButtonElement;

    word.click();
    fixture.detectChanges();

    expect(component.selectedToken()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Definición no disponible.'
    );

    component.saveStatus('KNOWN');
    statusResponse.next('<response/>');
    expect(component.readerData()!.tokens[0].status).toBe('KNOWN');
    expect(component.readerData()!.tokens[3].status).toBe('KNOWN');
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
    expect(service.setVocabularyStatus).toHaveBeenCalledOnce();
  });

  it('keeps vocabulary saving independent while lookup remains pending', () => {
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.selectWord(component.readerData()!.tokens[0], wordClick());

    component.saveStatus('KNOWN');
    statusResponse.next('<response/>');

    expect(component.lookupLoading()).toBe(true);
    expect(component.readerData()!.tokens[0].status).toBe('KNOWN');
    expect(component.readerData()!.tokens[3].status).toBe('KNOWN');
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
    expect(service.setVocabularyStatus).toHaveBeenCalledOnce();

    lookupResponse.error(new Error('provider unavailable'));
    expect(component.lookupUnavailable()).toBe(true);
    expect(component.readerData()!.tokens[0].status).toBe('KNOWN');
  });

  it('ignores an older lookup response after another word is selected', () => {
    const responseA = new Subject<string>();
    const responseB = new Subject<string>();
    dictionaryService.lookupWord
      .mockReturnValueOnce(responseA.asObservable())
      .mockReturnValueOnce(responseB.asObservable());
    dictionaryService.parseLookupWordResponse.mockImplementation((response) =>
      response === 'B'
        ? { ...dictionaryWord(), word: 'Algorithms', translation: 'algoritmos' }
        : dictionaryWord()
    );
    fixture.detectChanges();
    loadResponse.next('<response/>');
    const tokens = component.readerData()!.tokens;

    component.selectWord(tokens[0], wordClick());
    component.selectWord(tokens[6], wordClick());
    responseB.next('B');
    responseA.next('A');

    expect(dictionaryService.lookupWord).toHaveBeenCalledTimes(2);
    expect(component.dictionaryWord()?.word).toBe('Algorithms');
    expect(component.dictionaryWord()?.translation).toBe('algoritmos');
  });

  it('playing audio does not perform another lookup', async () => {
    const play = vi.fn(() => Promise.resolve());
    class AudioMock {
      readonly play = play;
    }
    vi.stubGlobal('Audio', AudioMock);
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.selectWord(component.readerData()!.tokens[0], wordClick());
    lookupResponse.next('<lookup/>');

    component.playAudio('https://audio.example/word.mp3');
    await Promise.resolve();

    expect(play).toHaveBeenCalledOnce();
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
  });

  it('handles audio playback rejection without closing the popover', async () => {
    class AudioMock {
      play(): Promise<void> {
        return Promise.reject(new Error('audio unavailable'));
      }
    }
    vi.stubGlobal('Audio', AudioMock);
    fixture.detectChanges();
    loadResponse.next('<response/>');
    component.selectWord(component.readerData()!.tokens[0], wordClick());

    component.playAudio('https://audio.example/word.mp3');
    await Promise.resolve();
    await Promise.resolve();

    expect(component.audioError()).toBe('Audio temporalmente no disponible');
    expect(component.selectedToken()).not.toBeNull();
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
  });

  function readerData(): ReaderData {
    return {
      readingId: 'reading-1',
      title: 'Learning Story',
      language: 'en',
      progressStatus: 'IN_PROGRESS',
      tokens: [
        {
          value: 'Learning',
          normalizedValue: 'learning',
          type: 'WORD',
          status: null,
        },
        { value: ',', normalizedValue: null, type: 'PUNCTUATION', status: null },
        { value: ' ', normalizedValue: null, type: 'WHITESPACE', status: null },
        {
          value: 'learning',
          normalizedValue: 'learning',
          type: 'WORD',
          status: 'NEW',
        },
        { value: '!', normalizedValue: null, type: 'PUNCTUATION', status: null },
        { value: ' ', normalizedValue: null, type: 'WHITESPACE', status: null },
        {
          value: 'Algorithms',
          normalizedValue: 'algorithms',
          type: 'WORD',
          status: null,
        },
      ],
    };
  }

  function dictionaryWord(): DictionaryWord {
    return {
      word: 'Learning',
      normalizedWord: 'learning',
      translation: 'aprendizaje',
      phonetic: '/ˈlɜː.nɪŋ/',
      audioUrl: 'https://audio.example/learning.mp3',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            {
              definition: 'The act of learning',
              example: 'Learning takes time.',
            },
            { definition: 'Knowledge acquired', example: null },
          ],
        },
      ],
    };
  }

  function wordClick(): MouseEvent {
    const element = document.createElement('button');
    element.getBoundingClientRect = () =>
      ({ left: 100, right: 160, top: 200, bottom: 230, width: 60, height: 30 } as DOMRect);
    return {
      stopPropagation: vi.fn(),
      currentTarget: element,
    } as unknown as MouseEvent;
  }
});
