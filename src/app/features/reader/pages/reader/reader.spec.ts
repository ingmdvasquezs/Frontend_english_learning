import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { DictionaryService, DictionaryWord } from '../../../../shared/services/dictionary';
import {
  ReaderData,
  ComprehensionQuiz,
  ComprehensionAttemptResult,
} from '../../models/reader.models';
import { ReaderService } from '../../services/reader';
import { Reader } from './reader';
import { NarrationService } from '../../../../shared/narration/narration.service';

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
    updateReadingProgress: ReturnType<typeof vi.fn>;
    completeReading: ReturnType<typeof vi.fn>;
    parseCompleteReading: ReturnType<typeof vi.fn>;
    getReadingComprehensionQuiz: ReturnType<typeof vi.fn>;
    submitComprehensionAttempt: ReturnType<typeof vi.fn>;
  };
  let dictionaryService: {
    lookupWord: ReturnType<typeof vi.fn>;
    parseLookupWordResponse: ReturnType<typeof vi.fn>;
  };
  let narration: {
    available: ReturnType<typeof signal<boolean>>;
    state: ReturnType<typeof signal<'IDLE'|'PLAYING'|'PAUSED'>>;
    rate: ReturnType<typeof signal<0.75|1|1.25|1.5>>;
    currentCharacterIndex: ReturnType<typeof signal<number|null>>;
    followAlongAvailable: ReturnType<typeof signal<boolean>>;
    play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>; restart: ReturnType<typeof vi.fn>; setRate: ReturnType<typeof vi.fn>;
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
      updateReadingProgress: vi.fn(() => of('<response/>')),
      completeReading: vi.fn(() => completionResponse.asObservable()),
      parseCompleteReading: vi.fn(() => ({ readingId: 'reading-1', status: 'COMPLETED', startedAt: '2026-08-30T10:00:00Z', completedAt: '2026-08-30T10:10:00Z' })),
      getReadingComprehensionQuiz: vi.fn(() => of({ readingId: 'reading-1', available: false, questions: [], selectionVersion: null })),
      submitComprehensionAttempt: vi.fn(),
    };
    dictionaryService = {
      lookupWord: vi.fn(() => lookupResponse.asObservable()),
      parseLookupWordResponse: vi.fn(() => dictionaryWord()),
    };
    const currentCharacterIndex=signal<number|null>(null);
    const narrationState = signal<'IDLE'|'PLAYING'|'PAUSED'>('IDLE');
    narration = { available:signal(true),state:narrationState,rate:signal(1),currentCharacterIndex,followAlongAvailable:signal(false),play:vi.fn(),pause:vi.fn(),resume:vi.fn(),stop:vi.fn(()=>{ currentCharacterIndex.set(null); narrationState.set('IDLE'); }),restart:vi.fn(),setRate:vi.fn() };
    class AudioMock {
      currentTime = 0;
      play(): Promise<void> { return Promise.resolve(); }
      pause(): void {}
    }
    vi.stubGlobal('Audio', AudioMock);

    await TestBed.configureTestingModule({
      imports: [Reader],
      providers: [
        provideRouter([]),
        { provide: ReaderService, useValue: service },
        { provide: DictionaryService, useValue: dictionaryService },
        { provide: NarrationService, useValue: narration },
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

  it.each(['PLATFORM','USER'])('narrates the current visible %s Part without autoplay', () => {
    fixture.detectChanges(); loadResponse.next('<response/>'); fixture.detectChanges();
    expect(narration.play).not.toHaveBeenCalled();
    const play = fixture.nativeElement.querySelector('.narration-launch') as HTMLButtonElement;
    expect(play.getAttribute('aria-label')).toBe('Escuchar parte');
    play.click();
    expect(narration.play).toHaveBeenCalledWith('Learning, learning! Algorithms','en');
    narration.currentCharacterIndex.set(10); fixture.detectChanges();
    const words=fixture.nativeElement.querySelectorAll('article button') as NodeListOf<HTMLButtonElement>;
    expect(words[1].classList.contains('narration-current')).toBe(true);
  });

  it('navigates stable Parts, clears transient state, scrolls and narrates only the new Part', () => {
    service.parseReaderData.mockReturnValue(longReaderData());
    const scroll = vi.spyOn(component, 'scrollReaderToTopAfterRender');
    fixture.detectChanges(); loadResponse.next('<response/>'); fixture.detectChanges();

    expect(component.parts()).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Parte 1 de 2');
    component.selectWord(component.currentPart()!.tokens[0], wordClick());
    narration.stop.mockClear();
    narration.currentCharacterIndex.set(0);
    narration.state.set('PLAYING');

    component.navigatePart(1);
    fixture.detectChanges();

    expect(component.currentPartIndex()).toBe(1);
    expect(component.selectedToken()).toBeNull();
    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.currentCharacterIndex()).toBeNull();
    expect(narration.play).not.toHaveBeenCalled();
    expect(scroll).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Parte 2 de 2');
    expect(service.updateReadingProgress).toHaveBeenLastCalledWith({
      readingId: 'reading-1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 2,
      paginationVersion: 1,
    });

    const play = fixture.nativeElement.querySelector('.narration-launch') as HTMLButtonElement;
    play.click();
    expect(narration.play).toHaveBeenCalledWith(component.currentPart()!.text, 'en');

    component.navigatePart(-1);
    expect(component.currentPartIndex()).toBe(0);
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(service.updateReadingProgress).toHaveBeenLastCalledWith({
      readingId: 'reading-1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 1,
      paginationVersion: 1,
    });
  });

  it.each(['PLATFORM', 'USER'])('restores the saved Part for a %s reading without autoplay', (origin) => {
    service.parseReaderData.mockReturnValue({
      ...multiPartReaderData(),
      readingId: `reading-${origin}`,
      currentPartOrdinal: 7,
      paginationVersion: 1,
    });

    fixture.detectChanges();
    loadResponse.next('<response/>');
    fixture.detectChanges();

    expect(component.currentPartIndex()).toBe(6);
    expect(component.currentPart()?.ordinal).toBe(7);
    expect(narration.play).not.toHaveBeenCalled();
    expect(narration.state()).toBe('IDLE');
    expect(component.selectedToken()).toBeNull();
    expect(service.updateReadingProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['legacy fields', null, null],
    ['incompatible version', 4, 2],
    ['ordinal zero', 0, 1],
    ['ordinal beyond total', 9, 1],
  ])('falls back safely to Part 1 for %s', (_case, ordinal, version) => {
    service.parseReaderData.mockReturnValue({
      ...multiPartReaderData(8),
      currentPartOrdinal: ordinal,
      paginationVersion: version,
    });

    fixture.detectChanges();
    loadResponse.next('<response/>');

    expect(component.currentPartIndex()).toBe(0);
    expect(component.currentPart()?.ordinal).toBe(1);
    expect(service.updateReadingProgress).not.toHaveBeenCalled();
  });

  it('restores an ordinal at the exact upper boundary', () => {
    service.parseReaderData.mockReturnValue({
      ...multiPartReaderData(8),
      currentPartOrdinal: 8,
      paginationVersion: 1,
    });

    fixture.detectChanges();
    loadResponse.next('<response/>');

    expect(component.currentPartIndex()).toBe(7);
    expect(component.currentPart()?.ordinal).toBe(8);
  });

  it('starts a NOT_STARTED reading once with Part 1 and the current pagination version', () => {
    service.parseReaderData.mockReturnValue({
      ...multiPartReaderData(),
      progressStatus: null,
      currentPartOrdinal: null,
      paginationVersion: null,
    });

    fixture.detectChanges();
    loadResponse.next('<response/>');

    expect(component.currentPartIndex()).toBe(0);
    expect(component.readerData()?.progressStatus).toBe('IN_PROGRESS');
    expect(service.updateReadingProgress).toHaveBeenCalledOnce();
    expect(service.updateReadingProgress).toHaveBeenCalledWith({
      readingId: 'reading-1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 1,
      paginationVersion: 1,
    });
  });

  it('keeps the new local Part and shows a discreet message when persistence fails', () => {
    service.parseReaderData.mockReturnValue(multiPartReaderData());
    service.updateReadingProgress.mockReturnValueOnce(
      throwError(() => new Error('SOAP'))
    );
    fixture.detectChanges();
    loadResponse.next('<response/>');

    component.navigatePart(1);
    fixture.detectChanges();

    expect(component.currentPartIndex()).toBe(1);
    expect(component.currentPart()?.ordinal).toBe(2);
    expect(component.progressError()).toContain('Puedes seguir leyendo');
    expect(fixture.nativeElement.textContent).toContain(
      'No pudimos guardar tu posición'
    );

    component.navigatePart(1);
    expect(component.currentPart()?.ordinal).toBe(3);
    expect(service.updateReadingProgress).toHaveBeenCalledTimes(2);
    expect(component.progressError()).toBeNull();
  });

  it('does not persist when Previous or Next cannot change the current Part', () => {
    service.parseReaderData.mockReturnValue(multiPartReaderData(2));
    fixture.detectChanges();
    loadResponse.next('<response/>');

    component.navigatePart(-1);
    expect(service.updateReadingProgress).not.toHaveBeenCalled();

    component.navigatePart(1);
    service.updateReadingProgress.mockClear();
    component.navigatePart(1);
    expect(component.currentPartIndex()).toBe(1);
    expect(service.updateReadingProgress).not.toHaveBeenCalled();
    expect(service.completeReading).not.toHaveBeenCalled();
  });

  it('serializes rapid Part updates so a late earlier response cannot overtake the final position', () => {
    const firstSave = new Subject<string>();
    const secondSave = new Subject<string>();
    service.parseReaderData.mockReturnValue(multiPartReaderData());
    service.updateReadingProgress
      .mockReturnValueOnce(firstSave.asObservable())
      .mockReturnValueOnce(secondSave.asObservable());
    fixture.detectChanges();
    loadResponse.next('<response/>');

    component.navigatePart(1);
    component.navigatePart(1);

    expect(component.currentPart()?.ordinal).toBe(3);
    expect(service.updateReadingProgress).toHaveBeenCalledTimes(1);
    expect(service.updateReadingProgress).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ currentPartOrdinal: 2 })
    );

    firstSave.next('<response/>');
    firstSave.complete();

    expect(service.updateReadingProgress).toHaveBeenCalledTimes(2);
    expect(service.updateReadingProgress).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ currentPartOrdinal: 3 })
    );
  });

  it('opens a completed reading at Part 1 and only starts rereading after real navigation', () => {
    service.parseReaderData.mockReturnValue({
      ...multiPartReaderData(),
      progressStatus: 'COMPLETED',
      currentPartOrdinal: 7,
      paginationVersion: 1,
    });
    fixture.detectChanges();
    loadResponse.next('<response/>');

    expect(component.currentPart()?.ordinal).toBe(1);
    expect(component.readerData()?.progressStatus).toBe('COMPLETED');
    expect(service.updateReadingProgress).not.toHaveBeenCalled();

    component.navigatePart(1);

    expect(component.readerData()?.progressStatus).toBe('IN_PROGRESS');
    expect(service.updateReadingProgress).toHaveBeenCalledWith(
      expect.objectContaining({ progressStatus: 'IN_PROGRESS', currentPartOrdinal: 2 })
    );
  });

  it('hides redundant Part navigation for a one-Part reading', () => {
    fixture.detectChanges(); loadResponse.next('<response/>'); fixture.detectChanges();
    expect(component.parts()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.text-part-heading')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.text-part-navigation')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.narration-launch')).toBeTruthy();
  });

  it('stops narration on destroy', () => {
    fixture.detectChanges(); narration.currentCharacterIndex.set(0);
    fixture.destroy();
    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.currentCharacterIndex()).toBeNull();
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
    expect(newOption.textContent?.trim()).toBe('NEW TO ME');
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
    expect(fixture.nativeElement.textContent).toContain('Looking up definitions...');

    lookupResponse.next('<lookup/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('/ˈlɜː.nɪŋ/');
    expect(fixture.nativeElement.textContent).toContain('aprendizaje');
    const translation = (Array.from(
      fixture.nativeElement.querySelectorAll('.reader-popover p') as NodeListOf<HTMLParagraphElement>
    )).find((paragraph) => paragraph.textContent?.trim() === 'aprendizaje');
    expect(translation).toBeTruthy();
    expect(translation!.classList.contains('text-white')).toBe(false);
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-label="Play pronunciation"]'
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
      'Definition unavailable.'
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

  it.each([
    ['PLATFORM', 'PLAYING'],
    ['USER', 'PAUSED'],
  ] as const)('autoplays once for %s with narration %s and lets manual audio repeat', async (_origin, narrationState) => {
    const play = vi.fn(() => Promise.resolve());
    class AudioMock {
      currentTime = 0;
      readonly play = play;
      readonly pause = vi.fn();
    }
    vi.stubGlobal('Audio', AudioMock);
    fixture.detectChanges();
    loadResponse.next('<response/>');
    narration.currentCharacterIndex.set(10);
    narration.state.set(narrationState);
    component.selectWord(component.readerData()!.tokens[0], wordClick());
    lookupResponse.next('<lookup/>');

    expect(play).toHaveBeenCalledOnce();
    expect(narration.stop).toHaveBeenCalledOnce();
    expect(narration.state()).toBe('IDLE');

    narration.currentCharacterIndex.set(10);
    component.playAudio('https://audio.example/word.mp3');
    await Promise.resolve();

    expect(play).toHaveBeenCalledTimes(2);
    expect(narration.stop).toHaveBeenCalledTimes(2);
    expect(narration.currentCharacterIndex()).toBeNull();
    expect(dictionaryService.lookupWord).toHaveBeenCalledOnce();
  });

  it('handles audio playback rejection without closing the popover', async () => {
    class AudioMock {
      currentTime = 0;
      pause(): void {}
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

  function longReaderData(): ReaderData {
    const tokens = Array.from({ length: 240 }, (_, index) => [
      {
        value: `word${index}`,
        normalizedValue: `word${index}`,
        type: 'WORD' as const,
        status: null,
      },
      {
        value: index === 119 ? '\n\n' : index === 239 ? '' : ' ',
        normalizedValue: null,
        type: 'WHITESPACE' as const,
        status: null,
      },
    ]).flat().filter((token) => token.value !== '');
    return { ...readerData(), tokens };
  }

  function multiPartReaderData(partCount = 8): ReaderData {
    const wordsPerPart = 120;
    const tokens = Array.from(
      { length: partCount * wordsPerPart },
      (_, index) => [
        {
          value: `word${index}`,
          normalizedValue: `word${index}`,
          type: 'WORD' as const,
          status: null,
        },
        {
          value:
            index === partCount * wordsPerPart - 1
              ? ''
              : (index + 1) % wordsPerPart === 0
                ? '\n\n'
                : ' ',
          normalizedValue: null,
          type: 'WHITESPACE' as const,
          status: null,
        },
      ]
    ).flat().filter((token) => token.value !== '');
    return { ...readerData(), tokens };
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

  function mockQuiz(available = true, selectionVersion: number | null = null): ComprehensionQuiz {
    return {
      readingId: 'reading-1',
      available,
      selectionVersion,
      questions: available
        ? [
            {
              questionId: 'q-1',
              ordinal: 1,
              questionType: 'FACTUAL',
              prompt: 'What did the main character do?',
              options: [
                { optionId: 'opt-1-1', ordinal: 1, content: 'He walked to the library.' },
                { optionId: 'opt-1-2', ordinal: 2, content: 'He stayed home.' },
                { optionId: 'opt-1-3', ordinal: 3, content: 'He went to work.' },
                { optionId: 'opt-1-4', ordinal: 4, content: 'He took a train.' },
              ],
            },
            {
              questionId: 'q-2',
              ordinal: 2,
              questionType: 'INFERENCE',
              prompt: 'Why was the character excited?',
              options: [
                { optionId: 'opt-2-1', ordinal: 1, content: 'Because it was sunny.' },
                { optionId: 'opt-2-2', ordinal: 2, content: 'Because of the new book.' },
                { optionId: 'opt-2-3', ordinal: 3, content: 'Because he won a prize.' },
                { optionId: 'opt-2-4', ordinal: 4, content: 'Because his friend arrived.' },
              ],
            },
            {
              questionId: 'q-3',
              ordinal: 3,
              questionType: 'MAIN_IDEA',
              prompt: 'What is the central theme of the story?',
              options: [
                { optionId: 'opt-3-1', ordinal: 1, content: 'Lifelong learning.' },
                { optionId: 'opt-3-2', ordinal: 2, content: 'Traveling abroad.' },
                { optionId: 'opt-3-3', ordinal: 3, content: 'Cooking dinner.' },
                { optionId: 'opt-3-4', ordinal: 4, content: 'Buying clothes.' },
              ],
            },
          ]
        : [],
    };
  }

  function mockVersionedQuiz(selectionVersion = 1): ComprehensionQuiz {
    return mockQuiz(true, selectionVersion);
  }

  function mockAttemptResult(): ComprehensionAttemptResult {
    return {
      attemptId: 'att-1',
      readingId: 'reading-1',
      submissionId: 'uuid-1',
      scorePercentage: 66.67,
      correctAnswersCount: 2,
      totalQuestionsCount: 3,
      submittedAt: '2026-09-12T10:00:00Z',
      questions: [
        {
          questionId: 'q-1',
          ordinal: 1,
          questionType: 'FACTUAL',
          prompt: 'What did the main character do?',
          selectedOptionId: 'opt-1-1',
          correctOptionId: 'opt-1-1',
          isCorrect: true,
          explanation: 'The text says he walked to the library.',
          options: [
            { optionId: 'opt-1-1', ordinal: 1, content: 'He walked to the library.' },
            { optionId: 'opt-1-2', ordinal: 2, content: 'He stayed home.' },
            { optionId: 'opt-1-3', ordinal: 3, content: 'He went to work.' },
            { optionId: 'opt-1-4', ordinal: 4, content: 'He took a train.' },
          ],
        },
        {
          questionId: 'q-2',
          ordinal: 2,
          questionType: 'INFERENCE',
          prompt: 'Why was the character excited?',
          selectedOptionId: 'opt-2-1',
          correctOptionId: 'opt-2-2',
          isCorrect: false,
          explanation: 'The context implies excitement came from the new book.',
          options: [
            { optionId: 'opt-2-1', ordinal: 1, content: 'Because it was sunny.' },
            { optionId: 'opt-2-2', ordinal: 2, content: 'Because of the new book.' },
            { optionId: 'opt-2-3', ordinal: 3, content: 'Because he won a prize.' },
            { optionId: 'opt-2-4', ordinal: 4, content: 'Because his friend arrived.' },
          ],
        },
        {
          questionId: 'q-3',
          ordinal: 3,
          questionType: 'MAIN_IDEA',
          prompt: 'What is the central theme of the story?',
          selectedOptionId: 'opt-3-1',
          correctOptionId: 'opt-3-1',
          isCorrect: true,
          explanation: 'Lifelong learning is central.',
          options: [
            { optionId: 'opt-3-1', ordinal: 1, content: 'Lifelong learning.' },
            { optionId: 'opt-3-2', ordinal: 2, content: 'Traveling abroad.' },
            { optionId: 'opt-3-3', ordinal: 3, content: 'Cooking dinner.' },
            { optionId: 'opt-3-4', ordinal: 4, content: 'Buying clothes.' },
          ],
        },
      ],
    };
  }

  describe('Comprehension Quiz (Phase 7B)', () => {
    it('does not check comprehension quiz availability while reading is IN_PROGRESS', () => {
      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      expect(service.getReadingComprehensionQuiz).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain('Comprobar mi comprensión');
    });

    it('prefetches quiz availability without submissionId upon completion and shows CTA', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(of(mockQuiz(true)));
      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      expect(service.getReadingComprehensionQuiz).toHaveBeenCalledWith('reading-1');
      expect(component.quizAvailable()).toBe(true);
      expect(component.activeComprehensionQuiz()).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Comprobar mi comprensión');
    });

    it('does not use prefetch questions directly for active quiz', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(of(mockQuiz(true)));
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      expect(component.activeComprehensionQuiz()).toBeNull();
      expect(component.quizMode()).toBe('COMPLETION');
      expect(fixture.nativeElement.querySelectorAll('fieldset').length).toBe(0);
    });

    it('keeps standard completion card when quiz available is false', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(of(mockQuiz(false)));
      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Lectura terminada');
      expect(fixture.nativeElement.textContent).not.toContain('Comprobar mi comprensión');
    });

    it('silently degrades to standard card when comprehension_not_available fault occurs', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(
        throwError(() => new Error('SOAP Fault: Comprehension quiz is only available for platform readings'))
      );
      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Lectura terminada');
      expect(fixture.nativeElement.textContent).not.toContain('Comprobar mi comprensión');
    });

    it('generates UUID1, displays inline loading, and makes second GET with UUID1 upon clicking CTA', () => {
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('UUID1' as `${string}-${string}-${string}-${string}-${string}`);
      const attemptQuizSubject = new Subject<ComprehensionQuiz>();
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return attemptQuizSubject.asObservable();
      });

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      const cta = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b: unknown) => (b as HTMLElement).textContent?.includes('Comprobar mi comprensión')
      ) as HTMLButtonElement;
      cta.click();
      fixture.detectChanges();

      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(component.quizLoading()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Cargando preguntas…');
      expect(service.getReadingComprehensionQuiz).toHaveBeenLastCalledWith('reading-1', 'UUID1');

      // Emit versioned quiz
      attemptQuizSubject.next(mockVersionedQuiz(1));
      fixture.detectChanges();

      expect(component.quizLoading()).toBe(false);
      expect(component.quizMode()).toBe('QUIZ');
      expect(component.activeComprehensionQuiz()?.selectionVersion).toBe(1);
      expect(fixture.nativeElement.textContent).toContain('Comprueba tu comprensión');
      expect(fixture.nativeElement.querySelectorAll('fieldset').length).toBe(3);

      uuidSpy.mockRestore();
    });

    it('renders 4 accessible radio options for each question', () => {
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      fixture.detectChanges();

      const fieldsets = fixture.nativeElement.querySelectorAll('fieldset');
      expect(fieldsets.length).toBe(3);
      fieldsets.forEach((fs: HTMLElement) => {
        const radios = fs.querySelectorAll('input[type="radio"]');
        expect(radios.length).toBe(4);
      });
    });

    it('does not open quiz when response is missing selectionVersion', () => {
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockQuiz(true, null));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      fixture.detectChanges();

      expect(component.quizMode()).toBe('COMPLETION');
      expect(component.activeComprehensionQuiz()).toBeNull();
      expect(component.quizLoadError()).toBe('No pudimos cargar las preguntas. Inténtalo de nuevo.');
      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las preguntas. Inténtalo de nuevo.');
      expect(fixture.nativeElement.textContent).toContain('Reintentar');
    });

    it('displays error and allows retry with same UUID1 when attempt GET fails', () => {
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('UUID1' as `${string}-${string}-${string}-${string}-${string}`);
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return throwError(() => new Error('Network error'));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      fixture.detectChanges();

      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(component.quizMode()).toBe('COMPLETION');
      expect(component.quizLoadError()).toBe('No pudimos cargar las preguntas. Inténtalo de nuevo.');

      // Retry GET with same UUID1
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (subId === 'UUID1') return of(mockVersionedQuiz(1));
        return of(mockQuiz(true));
      });

      const retryBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b: unknown) => (b as HTMLElement).textContent?.includes('Reintentar')
      ) as HTMLButtonElement;
      retryBtn.click();
      fixture.detectChanges();

      expect(service.getReadingComprehensionQuiz).toHaveBeenLastCalledWith('reading-1', 'UUID1');
      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(component.quizMode()).toBe('QUIZ');
      expect(component.activeComprehensionQuiz()?.selectionVersion).toBe(1);

      uuidSpy.mockRestore();
    });

    it('disables submit button while answers are incomplete and enables when all answered', () => {
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      fixture.detectChanges();

      expect(component.canSubmitQuiz()).toBe(false);

      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-2');
      fixture.detectChanges();
      expect(component.canSubmitQuiz()).toBe(false);

      component.selectAnswer('q-3', 'opt-3-1');
      fixture.detectChanges();
      expect(component.canSubmitQuiz()).toBe(true);
    });

    it('sends correct submit payload with UUID1 and selectionVersion received from server', () => {
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`);
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      service.submitComprehensionAttempt.mockReturnValue(of(mockAttemptResult()));

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-1');
      component.selectAnswer('q-3', 'opt-3-1');
      fixture.detectChanges();

      component.submitQuiz();

      expect(service.submitComprehensionAttempt).toHaveBeenCalledWith({
        readingId: 'reading-1',
        submissionId: 'mock-uuid-1234',
        selectionVersion: 1,
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-1-1' },
          { questionId: 'q-2', selectedOptionId: 'opt-2-1' },
          { questionId: 'q-3', selectedOptionId: 'opt-3-1' },
        ],
      });
      uuidSpy.mockRestore();
    });

    it('displays backend result, score, question feedback, and editorial explanations', () => {
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      service.submitComprehensionAttempt.mockReturnValue(of(mockAttemptResult()));

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-1');
      component.selectAnswer('q-3', 'opt-3-1');
      component.submitQuiz();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Resultado');
      expect(fixture.nativeElement.textContent).toContain('Resultado de este intento: 2 de 3 correctas · 66.67%');
      expect(fixture.nativeElement.textContent).toContain('✓ Correcta');
      expect(fixture.nativeElement.textContent).toContain('✕ Incorrecta');
      expect(fixture.nativeElement.textContent).toContain('The text says he walked to the library.');
      expect(fixture.nativeElement.textContent).toContain('Respuesta correcta:');
      expect(fixture.nativeElement.textContent).toContain('Because of the new book.');
    });

    it('preserves answers, UUID1, and selectionVersion on submit network failure and allows retry', () => {
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid-network' as `${string}-${string}-${string}-${string}-${string}`);
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      service.submitComprehensionAttempt.mockReturnValueOnce(throwError(() => new Error('Network error')));

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-1');
      component.selectAnswer('q-3', 'opt-3-1');

      component.submitQuiz();
      fixture.detectChanges();

      expect(component.comprehensionSubmitError()).toContain('No pudimos enviar tus respuestas');
      expect(component.selectedAnswers()).toEqual({
        'q-1': 'opt-1-1',
        'q-2': 'opt-2-1',
        'q-3': 'opt-3-1',
      });
      expect(component.currentSubmissionId()).toBe('mock-uuid-network');

      // Retry network submission: sends EXACTLY the same submissionId and selectionVersion
      service.submitComprehensionAttempt.mockReturnValueOnce(of(mockAttemptResult()));
      component.submitQuiz();

      expect(service.submitComprehensionAttempt).toHaveBeenLastCalledWith({
        readingId: 'reading-1',
        submissionId: 'mock-uuid-network',
        selectionVersion: 1,
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-1-1' },
          { questionId: 'q-2', selectedOptionId: 'opt-2-1' },
          { questionId: 'q-3', selectedOptionId: 'opt-3-1' },
        ],
      });
      uuidSpy.mockRestore();
    });

    it('generates UUID2, requests a NEW versioned quiz with UUID2, and does not reuse previous quiz on pedagogical retry', () => {
      let counter = 1;
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${counter++}` as `${string}-${string}-${string}-${string}-${string}`);
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      service.submitComprehensionAttempt.mockReturnValue(of(mockAttemptResult()));

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      expect(component.currentSubmissionId()).toBe('uuid-1');

      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-1');
      component.selectAnswer('q-3', 'opt-3-1');
      component.submitQuiz();
      fixture.detectChanges();
      expect(component.quizMode()).toBe('RESULT');

      // Click "Intentar de nuevo"
      const secondAttemptQuiz = {
        ...mockVersionedQuiz(1),
        questions: [
          { ...mockVersionedQuiz(1).questions[0], prompt: 'New question prompt 1' },
          { ...mockVersionedQuiz(1).questions[1], prompt: 'New question prompt 2' },
          { ...mockVersionedQuiz(1).questions[2], prompt: 'New question prompt 3' },
        ],
      };
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (subId === 'uuid-2') return of(secondAttemptQuiz);
        return of(mockVersionedQuiz(1));
      });

      component.retryQuiz();
      fixture.detectChanges();

      expect(component.currentSubmissionId()).toBe('uuid-2');
      expect(service.getReadingComprehensionQuiz).toHaveBeenLastCalledWith('reading-1', 'uuid-2');
      expect(component.quizMode()).toBe('QUIZ');
      expect(component.selectedAnswers()).toEqual({});
      expect(component.comprehensionResult()).toBeNull();
      expect(component.activeComprehensionQuiz()?.questions[0].prompt).toBe('New question prompt 1');

      uuidSpy.mockRestore();
    });

    it('returns to completion view and clears attempt state when canceling quiz', () => {
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      component.selectAnswer('q-1', 'opt-1-1');
      fixture.detectChanges();

      component.cancelQuiz();
      fixture.detectChanges();

      expect(component.quizMode()).toBe('COMPLETION');
      expect(component.activeComprehensionQuiz()).toBeNull();
      expect(component.currentSubmissionId()).toBeNull();
      expect(component.selectedAnswers()).toEqual({});
      expect(component.quizAvailable()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Lectura terminada');
      expect(fixture.nativeElement.textContent).toContain('Comprobar mi comprensión');
    });

    it('generates a new submissionId when reopening quiz after cancel', () => {
      let counter = 1;
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${counter++}` as `${string}-${string}-${string}-${string}-${string}`);
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      component.openQuiz();
      expect(component.currentSubmissionId()).toBe('uuid-1');

      component.cancelQuiz();
      expect(component.currentSubmissionId()).toBeNull();

      component.openQuiz();
      expect(component.currentSubmissionId()).toBe('uuid-2');
      expect(service.getReadingComprehensionQuiz).toHaveBeenLastCalledWith('reading-1', 'uuid-2');

      uuidSpy.mockRestore();
    });

    it('follows exact UUID sequence: UUID1 on open, GET retry, submit retry; UUID2 on pedagogical retry; UUID3 on cancel + reopen', () => {
      const generatedUuids: string[] = ['UUID1', 'UUID2', 'UUID3'];
      let uuidIndex = 0;
      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        return generatedUuids[uuidIndex++] as `${string}-${string}-${string}-${string}-${string}`;
      });

      // 1. Initial prefetch
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      service.submitComprehensionAttempt.mockReturnValue(of(mockAttemptResult()));

      fixture.detectChanges();
      loadResponse.next('<response/>');
      component.completeReading();
      completionResponse.next('<complete/>');
      fixture.detectChanges();

      // Open -> consumes UUID1
      service.getReadingComprehensionQuiz.mockImplementationOnce((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return throwError(() => new Error('GET error'));
      });
      component.openQuiz();
      fixture.detectChanges();
      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(uuidIndex).toBe(1);

      // GET retry -> keeps UUID1 (no new randomUUID call)
      service.getReadingComprehensionQuiz.mockImplementation((_rId: string, subId?: string) => {
        if (!subId) return of(mockQuiz(true));
        return of(mockVersionedQuiz(1));
      });
      component.retryLoadQuiz();
      fixture.detectChanges();
      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(uuidIndex).toBe(1);

      // Submit retry -> keeps UUID1 (no new randomUUID call)
      service.submitComprehensionAttempt.mockReturnValueOnce(throwError(() => new Error('Submit network error')));
      component.selectAnswer('q-1', 'opt-1-1');
      component.selectAnswer('q-2', 'opt-2-1');
      component.selectAnswer('q-3', 'opt-3-1');
      component.submitQuiz();
      fixture.detectChanges();
      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(uuidIndex).toBe(1);

      // Successful submit
      service.submitComprehensionAttempt.mockReturnValueOnce(of(mockAttemptResult()));
      component.submitQuiz();
      fixture.detectChanges();
      expect(component.quizMode()).toBe('RESULT');
      expect(component.currentSubmissionId()).toBe('UUID1');
      expect(uuidIndex).toBe(1);

      // Pedagogical retry -> consumes UUID2
      component.retryQuiz();
      fixture.detectChanges();
      expect(component.currentSubmissionId()).toBe('UUID2');
      expect(uuidIndex).toBe(2);

      // Cancel + reopen -> consumes UUID3
      component.cancelQuiz();
      expect(component.currentSubmissionId()).toBeNull();
      component.openQuiz();
      fixture.detectChanges();
      expect(component.currentSubmissionId()).toBe('UUID3');
      expect(uuidIndex).toBe(3);

      uuidSpy.mockRestore();
    });

    it('loads comprehension quiz when Reader is initially opened with COMPLETED status', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(of(mockQuiz(true)));
      service.parseReaderData.mockReturnValue({ ...readerData(), progressStatus: 'COMPLETED' });

      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      expect(service.getReadingComprehensionQuiz).toHaveBeenCalledWith('reading-1');
      expect(fixture.nativeElement.textContent).toContain('Comprobar mi comprensión');
    });

    it('does not break reader if availability check throws an error', () => {
      service.getReadingComprehensionQuiz.mockReturnValue(throwError(() => new Error('Server error')));
      service.parseReaderData.mockReturnValue({ ...readerData(), progressStatus: 'COMPLETED' });

      fixture.detectChanges();
      loadResponse.next('<response/>');
      fixture.detectChanges();

      expect(component.activeComprehensionQuiz()).toBeNull();
      expect(component.quizAvailable()).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Lectura terminada');
      expect(fixture.nativeElement.textContent).not.toContain('Comprobar mi comprensión');
    });
  });
});
