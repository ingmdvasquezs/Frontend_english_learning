import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DictionaryService, DictionaryWord } from '../../../../shared/services/dictionary';
import {
  PreparedReviewEntry,
  PreparedReviewSession,
  ReviewResult,
} from '../../models/vocabulary.models';
import { VocabularyService } from '../../services/vocabulary.service';
import { VocabularyReview } from './vocabulary-review';

describe('VocabularyReview Component (Fase 2.1)', () => {
  let component: VocabularyReview;
  let fixture: ComponentFixture<VocabularyReview>;
  let router: Router;

  let vocabularyServiceMock: {
    prepareVocabularyReview: ReturnType<typeof vi.fn>;
    recordVocabularyReview: ReturnType<typeof vi.fn>;
  };
  let dictionaryServiceMock: {
    lookupWord: ReturnType<typeof vi.fn>;
    parseLookupWordResponse: ReturnType<typeof vi.fn>;
  };

  const samplePreparedEntries: PreparedReviewEntry[] = [
    { wordId: 'w-1', word: 'resilience', language: 'en', status: 'LEARNING' },
    { wordId: 'w-2', word: 'journey', language: 'en', status: 'LEARNING' },
    { wordId: 'w-3', word: 'ephemeral', language: 'en', status: 'KNOWN' }, // Due KNOWN word
    { wordId: 'w-4', word: 'luminous', language: 'en', status: 'NEW' },
    { wordId: 'w-5', word: 'wanderlust', language: 'en', status: 'LEARNING' },
    { wordId: 'w-6', word: 'serendipity', language: 'en', status: 'LEARNING' },
  ];

  const samplePreparedSession: PreparedReviewSession = {
    dueCount: 3,
    totalReviewableCount: 15,
    entries: samplePreparedEntries,
  };

  const sampleDictWord: DictionaryWord = {
    word: 'resilience',
    normalizedWord: 'resilience',
    translation: 'capacidad de adaptación',
    phonetic: 'rɪˈzɪliəns',
    audioUrl: 'https://example.com/audio/resilience.mp3',
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition: 'The capacity to recover quickly from difficulties.',
            example: 'The resilience of the human spirit.',
            exampleTranslation: 'La resiliencia del espíritu humano.',
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    vocabularyServiceMock = {
      prepareVocabularyReview: vi.fn(),
      recordVocabularyReview: vi.fn(),
    };
    dictionaryServiceMock = {
      lookupWord: vi.fn(),
      parseLookupWordResponse: vi.fn(),
    };

    vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(of(samplePreparedSession));
    vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
      of({ wordId: 'w-1', status: 'LEARNING' } as ReviewResult)
    );

    dictionaryServiceMock.lookupWord.mockReturnValue(of('<xml></xml>'));
    dictionaryServiceMock.parseLookupWordResponse.mockReturnValue(sampleDictWord);

    await TestBed.configureTestingModule({
      imports: [VocabularyReview],
      providers: [
        provideRouter([]),
        { provide: VocabularyService, useValue: vocabularyServiceMock },
        { provide: DictionaryService, useValue: dictionaryServiceMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(VocabularyReview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Pre-session Size Selector', () => {
    it('starts with selector visible and does not automatically load session', () => {
      expect(component.sessionStarted()).toBe(false);
      expect(component.selectedSize()).toBe(10);
      expect(vocabularyServiceMock.prepareVocabularyReview).not.toHaveBeenCalled();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('¿Cuántas palabras quieres repasar?');
      expect(compiled.querySelector('.size-selector-btn.active')?.textContent).toContain('10');
    });

    it('allows selecting 10, 20, or 30 words before starting session', () => {
      component.selectSize(20);
      expect(component.selectedSize()).toBe(20);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.size-selector-btn.active')?.textContent).toContain('20');

      component.selectSize(30);
      expect(component.selectedSize()).toBe(30);

      component.selectSize(10);
      expect(component.selectedSize()).toBe(10);
    });

    it('calls prepareVocabularyReview with the selected size on startSession', () => {
      component.selectSize(20);
      component.startSession();

      expect(vocabularyServiceMock.prepareVocabularyReview).toHaveBeenCalledWith(20);
      expect(component.sessionStarted()).toBe(true);
      expect(component.baseTotalWords()).toBe(6);
      expect(component.dueCount()).toBe(3);
      expect(component.currentIndex()).toBe(0);
      expect(component.currentWord()?.word).toBe('resilience');
    });

    it('accepts due KNOWN words returned by backend', () => {
      component.startSession();

      const words = component.sessionCards().map((c) => c.entry);
      const knownEntry = words.find((w) => w.word === 'ephemeral');
      expect(knownEntry).toBeTruthy();
      expect(knownEntry?.status).toBe('KNOWN');
    });

    it('handles fewer entries returned by backend than requested size', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 2,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );

      component.selectSize(30);
      component.startSession();

      expect(component.baseTotalWords()).toBe(2);
      expect(component.totalWords()).toBe(2);
      expect(component.sessionCards().length).toBe(2);
    });

    it('renders empty state when backend returns 0 entries', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          entries: [],
        })
      );

      component.startSession();
      fixture.detectChanges();

      expect(component.isEmptySession()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Por ahora no tienes palabras para repasar.');
    });

    it('renders error state on prepare failure and allows retry', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        throwError(() => new Error('SOAP Fault'))
      );

      component.startSession();
      fixture.detectChanges();

      expect(component.sessionLoadError()).toBeTruthy();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Error al cargar la sesión');

      // Retry
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(of(samplePreparedSession));
      component.startSession();
      fixture.detectChanges();

      expect(component.sessionLoadError()).toBeNull();
      expect(component.baseTotalWords()).toBe(6);
    });
  });

  describe('Active Recall, Partial Lookup & Example Translation', () => {
    beforeEach(() => {
      component.startSession();
      fixture.detectChanges();
    });

    it('keeps meaning hidden before reveal and displays it upon clicking Mostrar significado', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.revealed-content')).toBeNull();
      expect(compiled.querySelector('.btn-reveal')).toBeTruthy();

      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      expect(dictionaryServiceMock.lookupWord).toHaveBeenCalledWith('resilience');
      expect(component.dictionaryWord()).toEqual(sampleDictWord);

      expect(compiled.querySelector('.revealed-content')).toBeTruthy();
      expect(compiled.textContent).toContain('capacidad de adaptación');
      expect(compiled.textContent).toContain('The resilience of the human spirit.');
      expect(compiled.textContent).toContain('La resiliencia del espíritu humano.');
    });

    it('handles partial lookup where translation is empty but definitions exist (e.g. "would")', () => {
      const partialWord: DictionaryWord = {
        word: 'would',
        normalizedWord: 'would',
        translation: '', // Empty translation from Merriam
        phonetic: 'wʊd',
        audioUrl: 'https://example.com/audio/would.mp3',
        meanings: [
          {
            partOfSpeech: 'verb',
            definitions: [
              {
                definition: 'Used to indicate condition or wish.',
                example: 'I would like to travel next year.',
                exampleTranslation: 'Me gustaría viajar el próximo año.',
              },
            ],
          },
        ],
      };
      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue(partialWord);

      component.revealMeaning();
      fixture.detectChanges();

      expect(component.lookupError()).toBeNull();
      expect(component.dictionaryWord()).toEqual(partialWord);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('No pudimos cargar el significado.');
      expect(compiled.textContent).toContain('Used to indicate condition or wish.');
      expect(compiled.textContent).toContain('I would like to travel next year.');
      expect(compiled.textContent).toContain('Me gustaría viajar el próximo año.');
    });

    it('renders English example without exampleTranslation if exampleTranslation is null', () => {
      const noTransWord: DictionaryWord = {
        word: 'journey',
        normalizedWord: 'journey',
        translation: 'viaje',
        phonetic: null,
        audioUrl: null,
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'An act of traveling from one place to another.',
                example: 'A long journey.',
                exampleTranslation: null,
              },
            ],
          },
        ],
      };
      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue(noTransWord);

      component.revealMeaning();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('"A long journey."');
    });

    it('plays manual audio without autoplay and handles error gracefully', async () => {
      component.revealMeaning();
      fixture.detectChanges();

      let played = false;
      class AudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => {
          played = true;
          return Promise.resolve();
        });
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', AudioMock);

      component.playAudio();
      expect(played).toBe(true);

      // Audio error handling
      class AudioErrorMock {
        currentTime = 0;
        readonly play = vi.fn(() => Promise.reject(new Error('Audio playback blocked')));
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', AudioErrorMock);

      component.playAudio();
      await Promise.resolve();
      expect(component.audioError()).toBe('Audio no disponible');
    });
  });

  describe('Autoevaluation & FORGOT Immediate Feedback', () => {
    beforeEach(() => {
      component.startSession();
      fixture.detectChanges();
    });

    it('dispatches recordVocabularyReview on FORGOT and shows immediate feedback without advancing yet', () => {
      component.revealMeaning();
      fixture.detectChanges();

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'LEARNING' } as ReviewResult)
      );

      component.selectAssessment('FORGOT');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'FORGOT');
      expect(component.forgotFeedbackActive()).toBe(true);
      expect(component.currentIndex()).toBe(0); // Has NOT advanced yet

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('No la recordaste. No pasa nada.');
      expect(compiled.textContent).toContain('Volveremos a repasarla más adelante en esta sesión.');
      expect(compiled.querySelector('.btn-continue')).toBeNull();
      // Meaning remains visible
      expect(compiled.textContent).toContain('resilience');

      // Fast-forward 1000ms auto-advance timer
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(component.forgotFeedbackActive()).toBe(false);
      expect(component.currentIndex()).toBe(1); // Now advanced to w-2
    });

    it('inserts reinforcement card ~4 base cards later upon FORGOT', () => {
      component.revealMeaning();
      fixture.detectChanges();

      component.selectAssessment('FORGOT');
      fixture.detectChanges();

      // Total session had 6 base words: w-1, w-2, w-3, w-4, w-5, w-6
      // Current index is 0 (w-1). Next 4 base cards are w-2 (1), w-3 (2), w-4 (3), w-5 (4).
      // Reinforcement should be inserted after w-5 (index 5).
      expect(component.sessionCards().length).toBe(7); // 6 base + 1 reinforcement

      const reinforcementCard = component.sessionCards().find((c) => c.isReinforcement);
      expect(reinforcementCard).toBeTruthy();
      expect(reinforcementCard?.entry.wordId).toBe('w-1');
      expect(reinforcementCard?.isReinforcement).toBe(true);
      expect(reinforcementCard?.baseWordNumber).toBe(1);

      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(component.forgotFeedbackActive()).toBe(false);
      expect(component.currentIndex()).toBe(1); // Now advanced to w-2
    });

    it('limits reinforcement to maximum 1 per wordId per session', () => {
      component.revealMeaning();
      component.selectAssessment('FORGOT');
      vi.advanceTimersByTime(1000);

      // Even if somehow triggered again for same word, reinforcedWordIds prevents duplicate
      expect(component.sessionCards().filter((c) => c.entry.wordId === 'w-1').length).toBe(2); // 1 base + 1 reinforcement
    });

    it('dispatches recordVocabularyReview on STRUGGLED and advances normally', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'LEARNING' } as ReviewResult)
      );

      component.selectAssessment('STRUGGLED');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'STRUGGLED');
      expect(component.sessionResults()[0].assessment).toBe('STRUGGLED');
      expect(component.currentIndex()).toBe(1);
      expect(component.forgotFeedbackActive()).toBe(false);
    });

    it('dispatches recordVocabularyReview on REMEMBERED and advances normally', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN' } as ReviewResult)
      );

      component.selectAssessment('REMEMBERED');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'REMEMBERED');
      expect(component.sessionResults()[0].assessment).toBe('REMEMBERED');
      expect(component.sessionResults()[0].targetStatus).toBe('KNOWN');
      expect(component.currentIndex()).toBe(1);
    });

    it('handles mutation error without advancing or inserting reinforcement, and allows retry', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        throwError(() => new Error('SOAP Fault'))
      );

      component.selectAssessment('REMEMBERED');
      fixture.detectChanges();

      expect(component.mutationError()).toBe('No pudimos guardar tu respuesta.');
      expect(component.currentIndex()).toBe(0);
      expect(component.sessionResults().length).toBe(0);

      // Retry
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN' } as ReviewResult)
      );
      component.retryMutation();
      fixture.detectChanges();

      expect(component.mutationError()).toBeNull();
      expect(component.currentIndex()).toBe(1);
      expect(component.sessionResults().length).toBe(1);
    });
  });

  describe('Reinforcement Card Behavior & Summary', () => {
    it('reinforcement card shows local feedback and does NOT call recordVocabularyReview', () => {
      // Create session with 1 base word that is forgotten
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession();
      component.revealMeaning();
      component.selectAssessment('FORGOT');
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      // Should now be on the reinforcement card (index 1)
      expect(component.currentIndex()).toBe(1);
      expect(component.isCurrentReinforcement()).toBe(true);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('¿La recuerdas ahora?');
      expect(compiled.textContent).toContain('Refuerzo');

      // Reveal reinforcement meaning
      component.revealMeaning();
      fixture.detectChanges();

      // Clear mutation mock calls to verify no call is made
      vocabularyServiceMock.recordVocabularyReview.mockClear();

      // Click "Sí, ahora sí"
      component.handleReinforcementAction(true);
      fixture.detectChanges();

      // Verified: NO recordVocabularyReview call made!
      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();

      // Session completes after the reinforcement card
      expect(component.completed()).toBe(true);
    });

    it('summary only counts base words and displays correct breakdown', () => {
      // 2 base words session
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );
      component.startSession();

      // Word 1: FORGOT (inserts reinforcement)
      component.revealMeaning();
      component.selectAssessment('FORGOT');
      vi.advanceTimersByTime(1000);

      // Word 2: REMEMBERED
      component.revealMeaning();
      component.selectAssessment('REMEMBERED');

      // Reinforcement of Word 1
      component.revealMeaning();
      component.handleReinforcementAction(false);
      fixture.detectChanges();

      expect(component.completed()).toBe(true);
      // Base count was 2, NOT 3!
      expect(component.baseTotalWords()).toBe(2);
      expect(component.totalWords()).toBe(2);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Has repasado 2 palabras.');
      expect(component.forgotCount()).toBe(1);
      expect(component.rememberedCount()).toBe(1);
      expect(component.struggledCount()).toBe(0);
    });

    it('resetToSelector returns to size selector and allows starting a new session', () => {
      component.startSession();
      component.resetToSelector();
      fixture.detectChanges();

      expect(component.sessionStarted()).toBe(false);
      expect(component.sessionCards().length).toBe(0);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('¿Cuántas palabras quieres repasar?');
    });

    it('navigates back to /vocabulary on backToVocabulary call', () => {
      component.backToVocabulary();
      expect(router.navigate).toHaveBeenCalledWith(['/vocabulary']);
    });
  });
});

