import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DictionaryService } from '../../../../shared/services/dictionary';
import { Auth } from '../../../auth/services/auth';
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

  beforeEach(async () => {
    localStorage.removeItem('english-reading-theme');
    onboardingService = {
      completeInitialVocabularyTest: vi.fn(() => of('<response/>')),
    };
    auth = { markOnboardingCompleted: vi.fn() };
    router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [Onboarding],
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
        {
          provide: DictionaryService,
          useValue: {
            lookupWord: vi.fn(),
            parseLookupWordResponse: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Onboarding);
    component = fixture.componentInstance;
  });

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

    component.finishTest();

    expect(onboardingService.completeInitialVocabularyTest).toHaveBeenCalledWith(
      'test-1',
      [
        { word: 'new-word', status: 'NEW' },
        { word: 'learning-word', status: 'LEARNING' },
        { word: 'known-word', status: 'KNOWN' },
        { word: 'ignored-word', status: 'IGNORED' },
      ]
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

    component.selectWordStatus('WORD', 'KNOWN');
    fixture.detectChanges();
    expect(component.getWordStatus('word')).toBe('KNOWN');
    expect(words.every((word) => !word.className.includes('bg-[#29445a]'))).toBe(
      true
    );
    expect(component.wordStatuses().has('word')).toBe(true);

    component.selectWordStatus('word', 'LEARNING');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('bg-[#4a3a22]'))).toBe(
      true
    );

    component.selectWordStatus('word', 'IGNORED');
    fixture.detectChanges();
    expect(words.every((word) => word.className.includes('text-[#70757b]'))).toBe(
      true
    );
  });
});
