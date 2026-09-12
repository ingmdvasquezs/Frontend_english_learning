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
    getInitialVocabularyTest: ReturnType<typeof vi.fn>;
    parseInitialVocabularyTest: ReturnType<typeof vi.fn>;
  };
  let auth: { markOnboardingCompleted: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let lookupWord: ReturnType<typeof vi.fn>;
  let parseLookupWordResponse: ReturnType<typeof vi.fn>;
  let audioPlay: ReturnType<typeof vi.fn>;
  let audioPause: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.removeItem('english-reading-theme');
    sessionStorage.clear();
    onboardingService = {
      completeInitialVocabularyTest: vi.fn(() => of('<response/>')),
      getInitialVocabularyTest: vi.fn(() => of('<response/>')),
      parseInitialVocabularyTest: vi.fn(() => ({
        testId: 'test-v2',
        text: 'Part one.\n\nPart two.\n\nPart three.\n\nPart four.',
        selectableWords: ['part', 'one', 'two', 'three', 'four'],
      })),
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

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('uses the global light theme and exposes the same persistent control', () => {
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe('light');
    (
      fixture.nativeElement.querySelector(
        'button[aria-label="Cambiar a modo oscuro"]'
      ) as HTMLButtonElement
    ).click();
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
  });

  it('renders unclassified words with null status and clean text without classifying an untouched word', () => {
    expect(component.getWordStatus('Untouched')).toBeNull();
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

  it('uses the shared Reader popover, autoplays pronunciation, and auto-closes on status selection with focus restoration', () => {
    renderTest();
    const word = fixture.nativeElement.querySelector(
      'section.relative button'
    ) as HTMLButtonElement;
    const focusSpy = vi.spyOn(word, 'focus');

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

    component.selectWordStatus('KNOWN');
    fixture.detectChanges();

    expect(component.getWordStatus('short')).toBe('KNOWN');
    expect(fixture.nativeElement.querySelector('app-reader-word-popover')).toBeFalsy();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('replays pronunciation manually and closes the shared popover with Escape', () => {
    renderTest();
    (fixture.nativeElement.querySelector('section.relative button') as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(
      'button[aria-label="Play pronunciation"]'
    ) as HTMLButtonElement).click();
    expect(audioPlay).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-reader-word-popover')).toBeFalsy();
  });

  it('navigates through 4 sections without losing accumulated classifications', () => {
    renderFourSectionTest();
    expect(component.totalSections()).toBe(4);
    expect(component.currentSectionIndex()).toBe(0);
    expect(component.isFirstSection()).toBe(true);
    expect(component.isLastSection()).toBe(false);

    // Section 1: classify a word
    component.setWordStatus('part', 'KNOWN');
    expect(component.classifiedWordCount()).toBe(1);

    // Navigate to section 2
    component.nextSection();
    fixture.detectChanges();
    expect(component.currentSectionIndex()).toBe(1);
    expect(component.isFirstSection()).toBe(false);
    expect(component.isLastSection()).toBe(false);
    expect(component.classifiedWordCount()).toBe(1);

    // Section 2: classify another word
    component.setWordStatus('two', 'LEARNING');
    expect(component.classifiedWordCount()).toBe(2);

    // Navigate to section 3
    component.nextSection();
    fixture.detectChanges();
    expect(component.currentSectionIndex()).toBe(2);

    // Navigate to section 4
    component.nextSection();
    fixture.detectChanges();
    expect(component.currentSectionIndex()).toBe(3);
    expect(component.isLastSection()).toBe(true);
    expect(component.classifiedWordCount()).toBe(2);

    // Navigate back to section 3
    component.previousSection();
    fixture.detectChanges();
    expect(component.currentSectionIndex()).toBe(2);
    expect(component.classifiedWordCount()).toBe(2);
  });

  it('does not allow finishing before the last section (Part 4) even with 10+ classified words', () => {
    renderFourSectionTest();
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    // Still in Part 1 (section 0)
    expect(component.currentSectionIndex()).toBe(0);
    expect(component.classifiedWordCount()).toBe(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    expect(component.canFinishTest()).toBe(false);
    expect(fixture.nativeElement.querySelector('.onboarding-finish-button')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.onboarding-next-button')).toBeTruthy();

    component.finishTest();
    expect(onboardingService.completeInitialVocabularyTest).not.toHaveBeenCalled();
  });

  it('keeps Finalizar onboarding disabled on Part 4 when fewer than 10 words are classified', () => {
    renderFourSectionTest();
    component.goToSection(3);
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS - 1);
    fixture.detectChanges();

    expect(component.isLastSection()).toBe(true);
    expect(component.canFinishTest()).toBe(false);
    const button = finishButton();
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(
      'onboarding-classification-progress'
    );

    component.finishTest();
    expect(onboardingService.completeInitialVocabularyTest).not.toHaveBeenCalled();
  });

  it('enables Finalizar onboarding on Part 4 with at least 10 classified words', () => {
    renderFourSectionTest();
    component.goToSection(3);
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    expect(component.isLastSection()).toBe(true);
    expect(component.canFinishTest()).toBe(true);
    const button = finishButton();
    expect(button.disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.onboarding-completion-guidance').textContent
    ).toContain(`${MINIMUM_ONBOARDING_CLASSIFICATIONS} de ${MINIMUM_ONBOARDING_CLASSIFICATIONS} palabras clasificadas`);
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

  it('submits only explicit statuses, marks completion, clears sessionStorage and navigates home', () => {
    renderFourSectionTest();
    component.goToSection(3);
    component.setWordStatus('new-word', 'NEW');
    component.setWordStatus('learning-word', 'LEARNING');
    component.setWordStatus('known-word', 'KNOWN');
    component.setWordStatus('ignored-word', 'IGNORED');
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS - 4, 'additional');

    component.finishTest();

    expect(onboardingService.completeInitialVocabularyTest).toHaveBeenCalledWith(
      'test-v2',
      component.explicitClassifications()
    );
    expect(auth.markOnboardingCompleted).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
    expect(component.loading()).toBe(false);
    expect(sessionStorage.getItem('onboarding_v2_test-v2')).toBeNull();
  });

  it('saves and restores onboarding state from sessionStorage', () => {
    component.loadTest();
    expect(component.test()?.testId).toBe('test-v2');

    component.setWordStatus('part', 'KNOWN');
    component.nextSection();
    fixture.detectChanges();

    expect(component.currentSectionIndex()).toBe(1);
    const saved = JSON.parse(sessionStorage.getItem('onboarding_v2_test-v2')!);
    expect(saved.sectionIndex).toBe(1);
    expect(saved.classifications).toEqual([['part', 'KNOWN']]);

    // Simulate page reload by loading test again
    component.loadTest();
    expect(component.currentSectionIndex()).toBe(1);
    expect(component.getWordStatus('part')).toBe('KNOWN');
  });

  it('includes an accessible skip link to onboarding controls', () => {
    renderTest();
    const skipLink = fixture.nativeElement.querySelector('a[href="#onboarding-controls"]') as HTMLAnchorElement;
    expect(skipLink).toBeTruthy();
    expect(skipLink.textContent?.trim()).toBe('Saltar a los controles');
  });

  it('keeps the user on onboarding and exposes SOAP errors', () => {
    onboardingService.completeInitialVocabularyTest.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );
    renderFourSectionTest();
    component.goToSection(3);
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
    renderFourSectionTest();
    component.goToSection(3);
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
    renderFourSectionTest();
    component.goToSection(3);
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    finishButton().click();
    fixture.detectChanges();
    finishButton().click();

    expect(onboardingService.completeInitialVocabularyTest).toHaveBeenCalledOnce();
    expect(component.loading()).toBe(true);
    expect(finishButton().disabled).toBe(true);
    expect(finishButton().textContent).toContain('Guardando...');
  });

  it('uses personalization copy without inventing CEFR, scoring, or exam levels', () => {
    renderFourSectionTest();
    component.goToSection(3);
    classifyWords(MINIMUM_ONBOARDING_CLASSIFICATIONS);
    fixture.detectChanges();

    const guidance = fixture.nativeElement.querySelector(
      '.onboarding-completion-guidance'
    ) as HTMLElement;
    expect(guidance.textContent).toContain('personalizar tus lecturas');
    expect(guidance.textContent).not.toMatch(/CEFR|comprensi[oó]n|nivel|examen/i);
  });

  it('reacts visually for every status, rendering unclassified words as clean text', () => {
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
    // Unclassified: clean editorial text without blue background and without underline/dotted decorations
    expect(words.every((word) => !word.className.includes('bg-[#29445a]'))).toBe(
      true
    );
    expect(words.every((word) => !word.className.includes('underline'))).toBe(
      true
    );
    expect(words.every((word) => !word.className.includes('decoration'))).toBe(
      true
    );
    expect(words.every((word) => word.className.includes('hover:bg-[var(--app-active)]'))).toBe(
      true
    );
    expect(component.wordStatuses().has('word')).toBe(false);

    // Classify as explicit NEW
    component.openWord('WORD', wordClick());
    component.selectWordStatus('NEW');
    fixture.detectChanges();
    expect(component.getWordStatus('word')).toBe('NEW');
    expect(words.every((word) => word.className.includes('bg-[#29445a]'))).toBe(
      true
    );

    // Classify as KNOWN
    component.openWord('WORD', wordClick());
    component.selectWordStatus('KNOWN');
    fixture.detectChanges();
    expect(component.getWordStatus('word')).toBe('KNOWN');
    expect(words.every((word) => word.className.includes('text-[#6fce9a]'))).toBe(
      true
    );

    // Classify as LEARNING
    component.openWord('WORD', wordClick());
    component.selectWordStatus('LEARNING');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('bg-[#4a3a22]'))).toBe(
      true
    );

    // Classify as IGNORED: discreet gray, no line-through
    component.openWord('WORD', wordClick());
    component.selectWordStatus('IGNORED');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('text-[#70757b]'))).toBe(
      true
    );
    expect(words.every((word) => word.className.includes('opacity-60'))).toBe(
      true
    );
    expect(words.every((word) => !word.className.includes('line-through'))).toBe(
      true
    );
  });

  it('renders punctuation directly attached to the word without an inter-element whitespace', () => {
    component.test.set({
      testId: 'test-punc',
      text: 'In autumn, the market.',
      selectableWords: ['autumn', 'market'],
    });
    fixture.detectChanges();

    const readingArea = fixture.nativeElement.querySelector('section.relative');
    const textContent = readingArea.textContent;
    expect(textContent).not.toContain('autumn ,');
    expect(textContent).not.toContain('market .');
    expect(textContent).toContain('autumn,');
    expect(textContent).toContain('market.');
  });

  function renderTest(): void {
    component.test.set({
      testId: 'test-1',
      text: 'A short onboarding text.',
      selectableWords: ['short'],
    });
    fixture.detectChanges();
  }

  function renderFourSectionTest(): void {
    component.test.set({
      testId: 'test-v2',
      text: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.',
      selectableWords: ['paragraph', 'one', 'two', 'three', 'four', 'part'],
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
