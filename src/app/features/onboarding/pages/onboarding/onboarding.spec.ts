import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { DictionaryService } from '../../../../shared/services/dictionary';
import { Auth } from '../../../auth/services/auth';
import { ReaderService } from '../../../reader/services/reader';
import {
  MINIMUM_ONBOARDING_CLASSIFICATIONS,
  VocabularyStatus,
} from '../../models/onboarding.models';
import { OnboardingService } from '../../services/onboarding';
import { Onboarding } from './onboarding';

describe('Onboarding', () => {
  let component: Onboarding;
  let fixture: ComponentFixture<Onboarding>;
  let onboardingService: {
    completeInitialVocabularyTest: ReturnType<typeof vi.fn>;
  };
  let auth: { markOnboardingCompleted: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let lookupWord: ReturnType<typeof vi.fn>;
  let parseLookupWordResponse: ReturnType<typeof vi.fn>;
  let audioPlay: ReturnType<typeof vi.fn>;
  let audioPause: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.removeItem('english-reading-theme');
    onboardingService = {
      completeInitialVocabularyTest: vi.fn(() => of('<response/>')),
    };
    auth = { markOnboardingCompleted: vi.fn() };
    router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };
    lookupWord = vi.fn(() => of('<lookup/>'));
    parseLookupWordResponse = vi.fn(() => dictionaryWord('short'));
    audioPlay = vi.fn(() => Promise.resolve());
    audioPause = vi.fn();
    class AudioMock {
      currentTime = 0;
      readonly play = audioPlay;
      readonly pause = audioPause;
    }
    vi.stubGlobal('Audio', AudioMock);

    await TestBed.configureTestingModule({
      imports: [Onboarding],
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
        { provide: ReaderService, useValue: { setVocabularyStatus: vi.fn() } },
        {
          provide: DictionaryService,
          useValue: {
            lookupWord,
            parseLookupWordResponse,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Onboarding);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the global light theme and exposes the same persistent control', () => {
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe('light');
    (fixture.nativeElement.querySelector('button[aria-label="Cambiar a modo oscuro"]') as HTMLButtonElement).click();
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
  });

  it('uses NEW visually without classifying an untouched word', () => {
    expect(component.getWordStatus('Untouched')).toBe('NEW');
    expect(component.classifiedWordCount()).toBe(0);
    expect(component.explicitClassifications()).toEqual([]);
  });

  it('keeps an explicit NEW classification in the final payload', () => {
    component.setWordStatus('First', 'NEW');
    component.setWordStatus('Second', 'KNOWN');

    expect(component.explicitClassifications()).toEqual([
      { word: 'first', status: 'NEW' },
      { word: 'second', status: 'KNOWN' },
    ]);
  });

  it('uses the shared Reader popover and autoplays one pronunciation when a word opens', () => {
    renderTest();
    const word = fixture.nativeElement.querySelector(
      'section.relative button'
    ) as HTMLButtonElement;

    word.click();
    fixture.detectChanges();

    expect(lookupWord).toHaveBeenCalledOnce();
    expect(audioPlay).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('app-reader-word-popover')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reader-popover')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('/test/');
    expect(fixture.nativeElement.textContent).toContain('corto');
    expect(
      fixture.nativeElement.querySelectorAll('.reader-popover button[aria-pressed]')
    ).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('Ver definiciones');
  });

  it('replays pronunciation manually and closes the shared popover with Escape', () => {
    renderTest();
    (fixture.nativeElement.querySelector('section.relative button') as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(
      'button[aria-label="Escuchar pronunciación"]'
    ) as HTMLButtonElement).click();
    expect(audioPlay).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-reader-word-popover')).toBeFalsy();
  });

  it.each([
    ['none', 0],
    ['one below the minimum', MINIMUM_ONBOARDING_CLASSIFICATIONS - 1],
  ])('keeps Finalizar onboarding disabled with %s classified words', (_case, count) => {
    renderTest();
    classifyWords(count);
    fixture.detectChanges();

    const button = finishButton();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(
      'onboarding-classification-progress'
    );
    component.finishTest();
    expect(onboardingService.completeInitialVocabularyTest).not.toHaveBeenCalled();
  });

  it.each([
    ['the minimum', MINIMUM_ONBOARDING_CLASSIFICATIONS],
    ['more than the minimum', MINIMUM_ONBOARDING_CLASSIFICATIONS + 1],
  ])('enables Finalizar onboarding with %s classified words', (_case, count) => {
    renderTest();
    classifyWords(count);
    fixture.detectChanges();

    expect(finishButton().disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.onboarding-completion-guidance').textContent
    ).toContain(`${count} palabras clasificadas`);
  });

  it.each(['NEW', 'LEARNING', 'KNOWN', 'IGNORED'] as const)(
    'counts an explicit %s classification',
    (status) => {
      component.setWordStatus(`word-${status}`, status);
      expect(component.classifiedWordCount()).toBe(1);
    }
  );

  it('keeps one unique classification when the same normalized word changes status', () => {
    component.setWordStatus('Travel', 'NEW');
    component.setWordStatus('travel', 'KNOWN');

    expect(component.classifiedWordCount()).toBe(1);
    expect(component.explicitClassifications()).toEqual([
      { word: 'travel', status: 'KNOWN' },
    ]);
  });

  it('counts repeated occurrences of the same normalized word only once', () => {
    component.test.set({
      testId: 'test-1',
      text: 'Travel travel TRAVEL.',
      selectableWords: ['travel'],
    });
    component.setWordStatus('TRAVEL', 'LEARNING');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('section.relative button')
    ).toHaveLength(3);
    expect(component.classifiedWordCount()).toBe(1);
  });

  it('submits only explicit statuses, marks completion and navigates home', () => {
    component.test.set({
      testId: 'test-1',
      text: 'Untouched',
      selectableWords: ['untouched'],
    });
    component.setWordStatus('new-word', 'NEW');
    component.setWordStatus('learning-word', 'LEARNING');
    component.setWordStatus('known-word', 'KNOWN');
    component.setWordStatus('ignored-word', 'IGNORED');
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS - 4, 'additional');

    component.finishTest();

    expect(onboardingService.completeInitialVocabularyTest).toHaveBeenCalledWith(
      'test-1',
      component.explicitClassifications()
    );
    expect(auth.markOnboardingCompleted).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
    expect(component.loading()).toBe(false);
  });

  it('keeps the user on onboarding and exposes SOAP errors', () => {
    onboardingService.completeInitialVocabularyTest.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );
    component.test.set({ testId: 'test-1', text: 'Word', selectableWords: [] });
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);

    component.finishTest();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(
      'No se pudo completar el vocabulario inicial'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo completar el vocabulario inicial'
    );
    expect(auth.markOnboardingCompleted).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('maps the backend minimum-classifications SOAP Fault to friendly copy', () => {
    onboardingService.completeInitialVocabularyTest.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: `<soapenv:Fault><faultstring>At least ${MINIMUM_ONBOARDING_CLASSIFICATIONS} unique vocabulary classifications are required</faultstring></soapenv:Fault>`,
          })
      )
    );
    renderTest();
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);

    component.finishTest();
    fixture.detectChanges();

    expect(component.error()).toBe(
      `Clasifica al menos ${MINIMUM_ONBOARDING_CLASSIFICATIONS} palabras antes de continuar.`
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'unique vocabulary classifications are required'
    );
  });

  it('disables submission while completion is pending and prevents a duplicate request', () => {
    const completion = new Subject<string>();
    onboardingService.completeInitialVocabularyTest.mockReturnValue(
      completion.asObservable()
    );
    renderTest();
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    finishButton().click();
    fixture.detectChanges();
    finishButton().click();

    expect(onboardingService.completeInitialVocabularyTest).toHaveBeenCalledOnce();
    expect(component.loading()).toBe(true);
    expect(finishButton().disabled).toBe(true);
    expect(finishButton().textContent).toContain('Guardando');
  });

  it('uses personalization copy without inventing CEFR or comprehension results', () => {
    renderTest();
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    const guidance = fixture.nativeElement.querySelector(
      '.onboarding-completion-guidance'
    ) as HTMLElement;
    expect(guidance.textContent).toContain('personalizar tus lecturas');
    expect(guidance.textContent).not.toMatch(/CEFR|comprensi[oó]n|nivel/i);
  });

  it('reacts visually for every status across repeated normalized words', () => {
    component.test.set({
      testId: 'test-1',
      text: 'Word word WORD.',
      selectableWords: ['word'],
    });
    fixture.detectChanges();

    const words = Array.from(
      fixture.nativeElement.querySelectorAll('section.relative button') as
        NodeListOf<HTMLButtonElement>
    );
    expect(words).toHaveLength(3);
    expect(words.every((word) => word.className.includes('bg-[#29445a]'))).toBe(
      true
    );
    expect(words.every((word) => !word.className.includes('bg-transparent'))).toBe(
      true
    );
    expect(words.every((word) => !word.className.includes('decoration-dotted'))).toBe(
      true
    );
    expect(component.wordStatuses().has('word')).toBe(false);

    component.openWord('WORD', wordClick());
    component.selectWordStatus('KNOWN');
    fixture.detectChanges();
    expect(component.getWordStatus('word')).toBe('KNOWN');
    expect(words.every((word) => !word.className.includes('bg-[#29445a]'))).toBe(
      true
    );
    expect(component.wordStatuses().has('word')).toBe(true);

    component.selectWordStatus('LEARNING');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('bg-[#4a3a22]'))).toBe(
      true
    );

    component.selectWordStatus('IGNORED');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('text-[#70757b]'))).toBe(
      true
    );
  });

  function renderTest(): void {
    component.test.set({
      testId: 'test-1',
      text: 'A short onboarding text.',
      selectableWords: ['short'],
    });
    fixture.detectChanges();
  }

  function classifyWords(
    count: number,
    prefix = 'classified'
  ): void {
    const statuses: readonly VocabularyStatus[] = [
      'NEW',
      'LEARNING',
      'KNOWN',
      'IGNORED',
    ];
    for (let index = 0; index < count; index += 1) {
      component.setWordStatus(
        `${prefix}-${index}`,
        statuses[index % statuses.length]
      );
    }
  }

  function finishButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '.onboarding-finish-button'
    ) as HTMLButtonElement;
  }

  function dictionaryWord(value: string) {
    return {
      word: value,
      normalizedWord: value,
      translation: 'corto',
      phonetic: '/test/',
      audioUrl: 'short.mp3',
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [{ definition: 'Having little length', example: null }],
        },
      ],
    };
  }

  function wordClick(): MouseEvent {
    const element = document.createElement('button');
    element.getBoundingClientRect = () =>
      ({ left: 100, right: 160, top: 200, bottom: 230, width: 60, height: 30 } as DOMRect);
    return { stopPropagation: vi.fn(), currentTarget: element } as unknown as MouseEvent;
  }
});
