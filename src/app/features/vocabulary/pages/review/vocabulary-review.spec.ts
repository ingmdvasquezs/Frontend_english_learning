import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DictionaryService, DictionaryWord } from '../../../../shared/services/dictionary';
import { NarrationService } from '../../../../shared/narration/narration.service';
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
    invalidatePreparationCache: ReturnType<typeof vi.fn>;
    setVocabularyStatus: ReturnType<typeof vi.fn>;
  };
  let dictionaryServiceMock: {
    lookupWord: ReturnType<typeof vi.fn>;
    parseLookupWordResponse: ReturnType<typeof vi.fn>;
  };
  let narrationMock: {
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    available: ReturnType<typeof signal>;
    state: ReturnType<typeof signal>;
  };

  const samplePreparedEntries: PreparedReviewEntry[] = [
    {
      wordId: 'w-1',
      word: 'resilience',
      language: 'en',
      status: 'LEARNING',
      srsState: 'LEARNING',
      ratingOptions: [
        { rating: 'AGAIN', nextReviewAt: '2026-09-18T16:40:00Z', intervalSeconds: 600 },
        { rating: 'GOOD', nextReviewAt: '2026-09-22T16:30:00Z', intervalSeconds: 345600 },
      ],
    },
    {
      wordId: 'w-2',
      word: 'journey',
      language: 'en',
      status: 'LEARNING',
      srsState: 'LEARNING',
      ratingOptions: [
        { rating: 'AGAIN', nextReviewAt: '2026-09-18T16:40:00Z', intervalSeconds: 600 },
        { rating: 'GOOD', nextReviewAt: '2026-09-22T16:30:00Z', intervalSeconds: 345600 },
      ],
    },
    { wordId: 'w-3', word: 'ephemeral', language: 'en', status: 'KNOWN', srsState: 'REVIEW' },
    { wordId: 'w-4', word: 'luminous', language: 'en', status: 'NEW', srsState: 'NEW' },
    { wordId: 'w-5', word: 'wanderlust', language: 'en', status: 'LEARNING', srsState: 'LEARNING' },
    { wordId: 'w-6', word: 'serendipity', language: 'en', status: 'LEARNING', srsState: 'LEARNING' },
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
      invalidatePreparationCache: vi.fn(),
      setVocabularyStatus: vi.fn(),
    };
    dictionaryServiceMock = {
      lookupWord: vi.fn(),
      parseLookupWordResponse: vi.fn(),
    };

    narrationMock = {
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      available: signal(true),
      state: signal('IDLE' as const),
    };

    class AudioMock {
      currentTime = 0;
      readonly play = vi.fn(() => Promise.resolve());
      readonly pause = vi.fn();
      constructor(readonly src: string) {}
    }
    vi.stubGlobal('Audio', AudioMock);

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
        { provide: NarrationService, useValue: narrationMock },
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

  describe('Daily Review Session Initialization (15 words)', () => {
    it('starts automatically on ngOnInit requesting 15 words by default', () => {
      expect(component.sessionStarted()).toBe(true);
      expect(vocabularyServiceMock.prepareVocabularyReview).toHaveBeenCalledWith(15);
      expect(component.baseTotalWords()).toBe(6);
      expect(component.dueCount()).toBe(3);
      expect(component.currentIndex()).toBe(0);
      expect(component.currentWord()?.word).toBe('resilience');
    });

    it('allows selecting 10, 15, 20, or 30 words if reset to selector', () => {
      component.resetToSelector();
      fixture.detectChanges();

      expect(component.sessionStarted()).toBe(false);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('¿Cuántas palabras quieres repasar?');

      component.selectSize(20);
      expect(component.selectedSize()).toBe(20);
      fixture.detectChanges();
      expect(compiled.querySelector('.size-selector-btn.active')?.textContent).toContain('20');

      component.startSession(20);
      expect(vocabularyServiceMock.prepareVocabularyReview).toHaveBeenCalledWith(20);
      expect(component.sessionStarted()).toBe(true);
    });

    it('accepts due KNOWN words returned by backend', () => {
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

      component.startSession(15);

      expect(component.baseTotalWords()).toBe(2);
      expect(component.totalWords()).toBe(2);
      expect(component.sessionCards().length).toBe(2);
    });

    it('renders empty state (Todo al día) when backend returns 0 entries', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          entries: [],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.isEmptySession()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Todo al día');
      expect(compiled.textContent).toContain('No tienes palabras pendientes de repaso hoy.');
    });

    it('renders error state on prepare failure and allows retry', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        throwError(() => new Error('SOAP Fault'))
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.sessionLoadError()).toBeTruthy();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Error al cargar la sesión');

      // Retry
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(of(samplePreparedSession));
      component.startSession(15);
      fixture.detectChanges();

      expect(component.sessionLoadError()).toBeNull();
      expect(component.baseTotalWords()).toBe(6);
    });
  });

  describe('Active Recall, Partial Lookup & Example Translation', () => {
    it('keeps translation and rating buttons hidden before reveal, but displays phonetic and audio on front', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.revealed-content')).toBeNull();
      expect(compiled.querySelector('.btn-reveal')).toBeTruthy();
      expect(compiled.querySelector('.rating-buttons-grid')).toBeNull();

      // Front shows word and audio, but NO visible phonetic
      expect(compiled.textContent).toContain('resilience');
      expect(compiled.textContent).not.toContain('/rɪˈzɪliəns/');
      expect(compiled.querySelector('.audio-btn')).toBeTruthy();
      expect(compiled.querySelector('.audio-btn')?.textContent).toContain('Escuchar');

      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      expect(compiled.querySelector('.revealed-content')).toBeTruthy();
      expect(compiled.querySelector('.rating-buttons-grid')).toBeTruthy();
      expect(compiled.textContent).toContain('capacidad de adaptación');
      expect(compiled.textContent).toContain('The resilience of the human spirit.');
      expect(compiled.textContent).toContain('La resiliencia del espíritu humano.');
    });

    it('handles partial lookup where translation is empty but definitions exist (e.g. "would")', () => {
      const partialWord: DictionaryWord = {
        word: 'would',
        normalizedWord: 'would',
        translation: '',
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
      component.retryLookup();
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
      component.retryLookup();
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

  describe('SRS V2 Ratings & Sub-day Repeat', () => {
    it('displays binary rating buttons (Again, Good) with formatted backend intervals, while Hard and Easy are absent', () => {
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.getFormattedInterval('AGAIN')).toBe('10m');
      expect(component.getFormattedInterval('GOOD')).toBe('4d');

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.btn-again')).toBeTruthy();
      expect(compiled.querySelector('.btn-good')).toBeTruthy();
      expect(compiled.querySelector('.btn-hard')).toBeNull();
      expect(compiled.querySelector('.btn-easy')).toBeNull();

      expect(compiled.querySelector('.btn-again')?.textContent).toContain('10m');
      expect(compiled.querySelector('.btn-good')?.textContent).toContain('4d');
    });

    it('dispatches recordVocabularyReview on AGAIN, queues for sub-day repeat, and advances card', () => {
      component.revealMeaning();
      fixture.detectChanges();

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'AGAIN');
      expect(component.againCount()).toBe(1);
      expect(component.currentIndex()).toBe(1); // Advanced to w-2
      expect(component.currentWord()?.word).toBe('journey');
    });

    it('dispatches recordVocabularyReview on HARD and advances normally', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'LEARNING', srsState: 'REVIEW' } as ReviewResult)
      );

      component.selectRating('HARD');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'HARD');
      expect(component.hardCount()).toBe(1);
      expect(component.currentIndex()).toBe(1);
    });

    it('dispatches recordVocabularyReview on GOOD and advances normally', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'GOOD');
      expect(component.goodCount()).toBe(1);
      expect(component.currentIndex()).toBe(1);
    });

    it('dispatches recordVocabularyReview on EASY and advances normally', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.selectRating('EASY');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'EASY');
      expect(component.easyCount()).toBe(1);
      expect(component.currentIndex()).toBe(1);
    });

    it('places AGAIN cards with future nextReviewAt into learningPool and advances to next due card', () => {
      // Create session with 2 words
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );
      component.startSession(15);
      component.revealMeaning();

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(), // 10 min in the future
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Card w-1 is in learningPool, and w-2 is now active
      expect(component.learningPool().length).toBe(1);
      expect(component.currentCard()?.entry.wordId).toBe('w-2');
      expect(component.baseTotalWords()).toBe(2);
    });

    it('handles mutation error without advancing, and allows retry', () => {
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        throwError(() => new Error('SOAP Fault'))
      );

      component.selectRating('GOOD');
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
      expect(component.goodCount()).toBe(1);
    });
  });

  describe('Keyboard Shortcuts & Summary', () => {
    it('reveals answer on Space key and selects rating on 1, 2, while 3 and 4 have no action', () => {
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      window.dispatchEvent(spaceEvent);
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);

      // Press 3 (no action in binary UI)
      const key3Event = new KeyboardEvent('keydown', { key: '3' });
      window.dispatchEvent(key3Event);
      fixture.detectChanges();
      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();

      // Press 4 (no action in binary UI)
      const key4Event = new KeyboardEvent('keydown', { key: '4' });
      window.dispatchEvent(key4Event);
      fixture.detectChanges();
      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();

      // Press 2 (GOOD)
      const key2Event = new KeyboardEvent('keydown', { key: '2' });
      window.dispatchEvent(key2Event);
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'GOOD');
      expect(component.goodCount()).toBe(1);
      expect(component.currentIndex()).toBe(1);
    });

    it('ignores 1-4 shortcuts before card is revealed', () => {
      expect(component.revealed()).toBe(false);

      const key1Event = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(key1Event);
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();
      expect(component.currentIndex()).toBe(0);
    });

    it('ignores keyboard shortcuts when focus is inside an input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(component.revealed()).toBe(false);
      document.body.removeChild(input);
    });

    it('displays completion summary with 4 count metrics and single return CTA when all cards completed', () => {
      // 2 words session
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 10,
          totalReviewableCount: 15,
          dailyComplete: true,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );
      component.startSession(15);

      // Word 1: HARD (graduates/reviews)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('HARD');

      // Word 2: GOOD (graduates/reviews)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-2', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      // When queues empty, reconcileWithBackend runs:
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.completed()).toBe(true);
      expect(component.totalWords()).toBe(2);
      expect(component.againCount()).toBe(0);
      expect(component.goodCount()).toBe(1);
      expect(component.hardCount()).toBe(1);
      expect(component.easyCount()).toBe(0);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Repaso de hoy completado');
      expect(compiled.textContent).toContain('Has terminado tus palabras de hoy.');
      expect(compiled.textContent).toContain('Vuelve mañana para continuar con tu siguiente sesión.');
      expect(compiled.querySelector('.btn-primary')?.textContent).toContain('Volver a Mi vocabulario');
      // No rating counters rendered in completion
      expect(compiled.textContent).not.toContain('Again 0');
      expect(compiled.textContent).not.toContain('Hard 1');
    });

    it('navigates back to /vocabulary on backToVocabulary call', () => {
      component.backToVocabulary();
      expect(router.navigate).toHaveBeenCalledWith(['/vocabulary']);
    });
  });

  describe('Continuous Review Queue, Learn-Ahead & Backend Reconciliation (FASE 14.3.4)', () => {
    it('prevents double-sending while a rating mutation is pending', () => {
      component.revealMeaning();
      component.mutationPending.set(true);

      component.selectRating('GOOD');
      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();

      const key2Event = new KeyboardEvent('keydown', { key: '2' });
      window.dispatchEvent(key2Event);
      expect(vocabularyServiceMock.recordVocabularyReview).not.toHaveBeenCalled();
    });

    it('displays each card own server intervals and stores updated options upon rating', () => {
      expect(component.getFormattedInterval('AGAIN')).toBe('10m');
      expect(component.getFormattedInterval('GOOD')).toBe('4d');

      // Rate w-1 with updated ratingOptions returned from backend
      component.revealMeaning();
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          ratingOptions: [
            { rating: 'AGAIN', intervalSeconds: 600 },
            { rating: 'GOOD', intervalSeconds: 518400 },
          ],
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      const queuedItem = component.learningPool().find((i) => i.entry.wordId === 'w-1');
      expect(queuedItem).toBeTruthy();
      expect(queuedItem?.entry.ratingOptions?.[1].intervalSeconds).toBe(518400);

      // Card w-2 now active - w-2 has its OWN intervals, not w-1's
      expect(component.currentCard()?.entry.wordId).toBe('w-2');
      expect(component.getFormattedInterval('GOOD')).toBe('4d');
    });

    // A: entries=[] learnAheadEntries=6 -> first card immediately visible, no manual advance button
    it('A: when entries=[] and learnAheadEntries=6, first card is immediately visible without manual button', () => {
      const learnAheadEntries: PreparedReviewEntry[] = Array.from({ length: 6 }, (_, i) => ({
        wordId: `la-${i + 1}`,
        word: `learnword${i + 1}`,
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
      }));

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 6,
          dailyComplete: false,
          entries: [],
          learnAheadEntries,
        })
      );
      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()).toBeTruthy();
      expect(component.currentCard()?.entry.wordId).toBe('la-1');
      expect(component.isWaitingForFutureLearning()).toBe(false);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Adelantar repaso');
    });

    // B: AGAIN -> 10m -> returns through learn-ahead
    it('B: AGAIN with 10m returns card through learn-ahead window', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);
      expect(component.currentCard()?.entry.wordId).toBe('w-1');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Since w-1 is the only card and 10m <= 20m window, it returns immediately!
      expect(component.currentCard()?.entry.wordId).toBe('w-1');
      expect(component.currentCard()?.isAgainRepeat).toBe(true);
      expect(component.revealed()).toBe(false);
    });

    // C: AGAIN -> AGAIN -> returns repeatedly
    it('C: AGAIN followed by AGAIN returns card repeatedly without artificial limit', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      for (let i = 0; i < 3; i++) {
        expect(component.currentCard()?.entry.wordId).toBe('w-1');
        vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
          of({
            wordId: 'w-1',
            status: 'LEARNING',
            srsState: 'RELEARNING',
            nextReviewAt: new Date(Date.now() + 600000).toISOString(),
            intervalSeconds: 600,
          } as ReviewResult)
        );
        component.revealMeaning();
        component.selectRating('AGAIN');
        fixture.detectChanges();
      }

      expect(component.againCount()).toBe(3);
      expect(component.currentCard()?.entry.wordId).toBe('w-1');
    });

    // D: HARD -> 15m -> returns through learn-ahead
    it('D: HARD with 15m returns through learn-ahead once due queue is exhausted', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );
      component.startSession(15);

      // Rate w-1 HARD with 15m (900s)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          nextReviewAt: new Date(Date.now() + 900000).toISOString(),
          intervalSeconds: 900,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('HARD');
      fixture.detectChanges();

      // w-2 is now active from dueQueue
      expect(component.currentCard()?.entry.wordId).toBe('w-2');

      // Rate w-2 GOOD (exits to REVIEW)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-2', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Now dueQueue is empty, so w-1 (15m <= 20m) automatically returns!
      expect(component.currentCard()?.entry.wordId).toBe('w-1');
      expect(component.currentCard()?.isLearnAhead).toBe(true);
    });

    // E: only one card + AGAIN -> immediately selected again -> revealed=false
    it('E: only one card + AGAIN is immediately selected again with revealed=false', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);
      component.revealMeaning();
      expect(component.revealed()).toBe(true);

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
        } as ReviewResult)
      );
      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-1');
      expect(component.revealed()).toBe(false);
    });

    // F: GOOD/EASY -> REVIEW -> removed from learningPool
    it('F: GOOD/EASY resulting in REVIEW is removed from learningPool completely', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      // Reconcile will return empty when queues become empty
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'KNOWN',
          srsState: 'REVIEW',
          nextReviewAt: new Date(Date.now() + 86400000 * 4).toISOString(),
          intervalSeconds: 345600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.learningPool().length).toBe(0);
      expect(component.completed()).toBe(true);
    });

    // G: RELEARNING +25m -> retained but not selectable -> waiting state
    it('G: RELEARNING scheduled at +25m is retained in pool but not selectable, showing waiting state', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          intervalSeconds: 1500,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.learningPool().length).toBe(1);
      expect(component.currentCard()).toBeNull();
      expect(component.isWaitingForFutureLearning()).toBe(true);
      expect(component.completed()).toBe(false);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Próximo repaso en');
      expect(compiled.textContent).not.toContain('Sesión completada');
      expect(compiled.textContent).not.toContain('Adelantar repaso');
    });

    // H: queues empty -> frontend calls prepare again -> does NOT immediately complete
    it('H: when queues empty, frontend calls prepare again and does not immediately complete if items returned', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      // Next prepare call (reconciliation) returns another due card
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[1]],
          learnAheadEntries: [],
          dailyComplete: false,
        })
      );
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Card w-2 from reconciliation is now active!
      expect(component.completed()).toBe(false);
      expect(component.currentCard()?.entry.wordId).toBe('w-2');
    });

    // I: reconciliation returns learnAheadEntries -> session resumes
    it('I: reconciliation returns learnAheadEntries and session resumes without completed', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      const futureEntry: PreparedReviewEntry = {
        wordId: 'rec-future',
        word: 'reconciledword',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
      };

      // Reconciliation returns a learnAheadEntry
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 1,
          entries: [],
          learnAheadEntries: [futureEntry],
          dailyComplete: false,
        })
      );
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.completed()).toBe(false);
      expect(component.currentCard()?.entry.wordId).toBe('rec-future');
    });

    // J: reconciliation returns dailyComplete true + no pending -> completion
    it('J: reconciliation returns dailyComplete=true and no pending leads to completion', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.completed()).toBe(true);
      expect(component.isDailyComplete()).toBe(true);
    });

    // K: stale dailyComplete true + local relearning -> NO completion
    it('K: stale dailyComplete=true with active local relearning card does NOT end session', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          dailyComplete: true,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Card is still relearning, so session does NOT complete!
      expect(component.completed()).toBe(false);
      expect(component.currentCard()?.entry.wordId).toBe('w-1');
      expect(component.isDailyComplete()).toBe(false);
    });

    // L: completion HTML does NOT contain rating counters
    it('L: completion HTML does NOT contain rating counters or colored numbers', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Repaso de hoy completado');
      expect(compiled.textContent).not.toContain('Again 1');
      expect(compiled.textContent).not.toContain('Hard 0');
      expect(compiled.textContent).not.toContain('Good 1');
      expect(compiled.textContent).not.toContain('Easy 0');
    });

    // M: template does NOT render phonetic/IPA
    it('M: template does NOT render phonetic or IPA transcriptions', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('/rɪˈzɪliəns/');
      expect(compiled.querySelector('.phonetic-display')).toBeNull();
    });

    // N: audio Escuchar remains functional
    it('N: audio Escuchar button remains functional when audioUrl exists', () => {
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [samplePreparedEntries[0]],
        })
      );
      component.startSession(15);
      fixture.detectChanges();

      const audioBtn = (fixture.nativeElement as HTMLElement).querySelector('.audio-btn') as HTMLButtonElement;
      expect(audioBtn).toBeTruthy();
      expect(audioBtn.textContent).toContain('Escuchar');

      const playSpy = vi.spyOn(component, 'playAudio');
      audioBtn.click();
      expect(playSpy).toHaveBeenCalled();
    });

    // O: No "Adelantar repaso" required
    it('O: never requires "Adelantar repaso" button to continue review', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Adelantar repaso');
    });

    // Section 19: Functional Test demonstrating 6 learn-ahead cards with fake timers
    it('19: Functional Test - full progression of 6 learn-ahead cards with Again and Good to completion', () => {
      const cards: PreparedReviewEntry[] = Array.from({ length: 6 }, (_, i) => ({
        wordId: `w-flow-${i + 1}`,
        word: `word${i + 1}`,
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
      }));

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 6,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: cards,
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // Card 1 immediately visible
      expect(component.currentCard()?.entry.wordId).toBe('w-flow-1');

      // Card 1 -> AGAIN -> returns to pool
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-flow-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Card 2 is now shown
      expect(component.currentCard()?.entry.wordId).toBe('w-flow-2');

      // Review cards 2 through 6 with GOOD -> they graduate to REVIEW
      for (let i = 2; i <= 6; i++) {
        expect(component.currentCard()?.entry.wordId).toBe(`w-flow-${i}`);
        vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
          of({
            wordId: `w-flow-${i}`,
            status: 'KNOWN',
            srsState: 'REVIEW',
          } as ReviewResult)
        );
        component.revealMeaning();
        component.selectRating('GOOD');
        fixture.detectChanges();
      }

      // Now all other cards graduated. Card 1 returns again!
      expect(component.currentCard()?.entry.wordId).toBe('w-flow-1');
      expect(component.revealed()).toBe(false);

      // Card 1 -> AGAIN once more -> returns again!
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-flow-1',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-flow-1');
      expect(component.revealed()).toBe(false);

      // Card 1 -> GOOD -> graduates to REVIEW!
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-flow-1',
          status: 'KNOWN',
          srsState: 'REVIEW',
        } as ReviewResult)
      );
      // Queues are empty, reconciliation is triggered:
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Session completes cleanly!
      expect(component.completed()).toBe(true);
      expect(component.isDailyComplete()).toBe(true);
      expect(component.currentCard()).toBeNull();
    });
  });

  describe('FASE 14.3.6 Mandatory Requirements & Corrections Verification', () => {
    it('Requirement 1: Pending cards are presented strictly by pendingQueueSequence ASC (FIFO)', () => {
      // Card B has sequence 2, Card C has sequence 3 (even if Card C is in entries and Card B is in learnAhead)
      const cardB: PreparedReviewEntry = {
        wordId: 'w-card-b',
        word: 'benevolent',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        baseOrder: null,
        nextReviewAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-card-c',
        word: 'candor',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        baseOrder: null,
        nextReviewAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // earlier time, but higher sequence!
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 2,
          dailyComplete: false,
          entries: [cardC], // Card C is in entries
          learnAheadEntries: [cardB], // Card B is in learnAheadEntries
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // Card B (seq 2) must appear FIRST, before Card C (seq 3)
      expect(component.currentCard()?.entry.wordId).toBe('w-card-b');
      expect(component.currentCard()?.entry.word).toBe('benevolent');

      // Rate Card B GOOD (graduates)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-card-b', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Card C (seq 3) appears NEXT
      expect(component.currentCard()?.entry.wordId).toBe('w-card-c');
      expect(component.currentCard()?.entry.word).toBe('candor');
    });

    it('Requirement 2: Phase A studies base cards by baseOrder ASC, then Phase B FIFO pending cards', () => {
      const base1: PreparedReviewEntry = {
        wordId: 'w-base-1',
        word: 'first',
        language: 'en',
        status: 'LEARNING',
        srsState: 'NEW',
        baseOrder: 1,
        pendingQueueSequence: null,
      };
      const base2: PreparedReviewEntry = {
        wordId: 'w-base-2',
        word: 'second',
        language: 'en',
        status: 'LEARNING',
        srsState: 'NEW',
        baseOrder: 2,
        pendingQueueSequence: null,
      };
      const pending1: PreparedReviewEntry = {
        wordId: 'w-pend-1',
        word: 'repeat',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        baseOrder: null,
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 3,
          dailyLimit: 15,
          dailyBaseCompleted: 0,
          entries: [base2, base1], // unordered
          learnAheadEntries: [pending1],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // Base 1 (baseOrder 1) first
      expect(component.currentCard()?.entry.wordId).toBe('w-base-1');
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-base-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Base 2 (baseOrder 2) second
      expect(component.currentCard()?.entry.wordId).toBe('w-base-2');
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-base-2', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Base queue empty -> pending 1 is presented automatically
      expect(component.currentCard()?.entry.wordId).toBe('w-pend-1');
    });

    it('Correction 1: Completely eliminates "Adelantar repaso" button and automatically presents eligible card', () => {
      const eligibleAhead: PreparedReviewEntry = {
        wordId: 'w-ahead-1',
        word: 'automatic',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min in future (<= 20m)
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 1,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [eligibleAhead],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // Card is displayed immediately
      expect(component.currentCard()?.entry.wordId).toBe('w-ahead-1');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Adelantar repaso');
      expect(compiled.textContent).not.toContain('Adelantar');
    });

    it('Correction 2: Local progress calculation avoids double-counting on reconciliation and clamps migration', () => {
      // Start with dailyBaseCompleted = 5 from backend
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 15,
          dailyLimit: 15,
          dailyBaseCompleted: 5,
          dailyBaseRemaining: 10,
          entries: [samplePreparedEntries[0], samplePreparedEntries[1]],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.displayCompleted()).toBe(5);

      // Review card 1 -> localBaseIntroducedCount becomes 1 -> displayCompleted = 6
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();
      expect(component.displayCompleted()).toBe(6);

      // Review card 2 -> localBaseIntroducedCount becomes 2 -> displayCompleted = 7
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-2', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      // Backend reconciliation returns updated dailyBaseCompleted = 7
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 15,
          dailyLimit: 15,
          dailyBaseCompleted: 7,
          dailyBaseRemaining: 8,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
          dailyComplete: false,
        })
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Reconciled: localBaseIntroducedCount reset to 0, baseline=7 -> displayCompleted remains 7 (NOT 9!)
      expect(component.dailyBaseCompleted()).toBe(7);
      expect(component.localBaseIntroducedCount()).toBe(0);
      expect(component.displayCompleted()).toBe(7);

      // Migration clamping test: dailyBaseCompleted = 31 with dailyLimit = 15
      component.dailyBaseCompleted.set(31);
      component.dailyLimit.set(15);
      component.localBaseIntroducedCount.set(0);
      expect(component.displayCompleted()).toBe(15);
    });

    it('Correction 3: Cache is invalidated on review actions and direct route protection works', () => {
      // Invalidate cache on backToVocabulary
      component.backToVocabulary();
      expect(vocabularyServiceMock.invalidatePreparationCache).toHaveBeenCalled();

      // Direct route protection: dailyComplete is true and no cards remain
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyLimit: 15,
          dailyBaseCompleted: 15,
          dailyBaseRemaining: 0,
          pendingLearningCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.completed()).toBe(true);
      expect(component.isDailyComplete()).toBe(true);
      expect(component.currentCard()).toBeNull();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Repaso de hoy completado');
    });

    it('Repeated ratings loop: AGAIN -> HARD -> GOOD stays pending then exits to REVIEW with answer hidden on reappearance', () => {
      const loopCard: PreparedReviewEntry = {
        wordId: 'w-loop-1',
        word: 'persistence',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [loopCard],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-loop-1');
      expect(component.revealed()).toBe(false);

      // Rate AGAIN -> returns to tail with pendingQueueSequence 10
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-loop-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 10,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );
      component.revealMeaning();
      expect(component.revealed()).toBe(true);
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Re-presented with answer hidden!
      expect(component.currentCard()?.entry.wordId).toBe('w-loop-1');
      expect(component.revealed()).toBe(false);

      // Rate HARD -> returns to tail with pendingQueueSequence 20
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-loop-1',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 20,
          nextReviewAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          intervalSeconds: 900,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('HARD');
      fixture.detectChanges();

      // Re-presented again with answer hidden!
      expect(component.currentCard()?.entry.wordId).toBe('w-loop-1');
      expect(component.revealed()).toBe(false);

      // Rate GOOD -> srsState: REVIEW -> graduates and leaves queue!
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-loop-1',
          status: 'KNOWN',
          srsState: 'REVIEW',
        } as ReviewResult)
      );
      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 0,
          totalReviewableCount: 0,
          dailyComplete: true,
          entries: [],
          learnAheadEntries: [],
          pendingLearningCount: 0,
        })
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.completed()).toBe(true);
      expect(component.currentCard()).toBeNull();
    });
  });

  describe('Fase 14.3.6.1 — Spanish Meaning Retention & FIFO Repeat Mechanics', () => {
    it('Bug 1: Spanish meaning and lexical data survive SRS Again/Hard update and are visible on reveal', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-meaning',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      const meaningDict: DictionaryWord = {
        word: 'meaning',
        normalizedWord: 'meaning',
        translation: 'Significado',
        phonetic: 'ˈmiːnɪŋ',
        audioUrl: 'https://example.com/audio/meaning.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'the idea that is represented by a word, phrase, etc.',
                example: 'What is the meaning of this word?',
                exampleTranslation: '¿Cuál es el significado de esta palabra?',
              },
            ],
          },
        ],
      };

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue(meaningDict);

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-meaning');
      expect(component.revealed()).toBe(false);

      // Before reveal: translation is NOT rendered in DOM
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Significado');

      // Reveal card
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Significado');
      expect(component.dictionaryWord()?.translation).toBe('Significado');

      // Rate AGAIN -> Backend returns fresh SRS metadata (without lexical fields)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-meaning',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 2,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Single card exception: w-meaning reappears
      expect(component.currentCard()?.entry.wordId).toBe('w-meaning');
      // Must be hidden on reappearance!
      expect(component.revealed()).toBe(false);
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Significado');

      // Lexical data SURVIVES!
      expect(component.currentCard()?.dictionaryWord?.translation).toBe('Significado');
      expect(component.dictionaryWord()?.translation).toBe('Significado');

      // When revealed again, Spanish meaning is instantly visible
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Significado');
    });

    it('Bug 2 (AGAIN): With multiple pending cards [A, B, C], rating A AGAIN presents B next and queues [B, C, A]', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // First card presented is A (seq 1)
      expect(component.currentCard()?.entry.wordId).toBe('w-a');
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-b', 'w-c']);

      // Rate A AGAIN -> server assigns pendingQueueSequence: 4
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // NEXT card presented MUST BE B (w-b), NEVER A (w-a)!
      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      // Pending queue MUST now be [C, A]
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-c', 'w-a']);
      expect(component.pendingQueue().map((c) => c.entry.pendingQueueSequence)).toEqual([3, 4]);
    });

    it('Bug 2 (HARD): With multiple pending cards [A, B, C], rating A HARD presents B next and queues [B, C, A]', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      // Rate A HARD -> server assigns pendingQueueSequence: 4
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          intervalSeconds: 900,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('HARD');
      fixture.detectChanges();

      // NEXT card presented MUST BE B (w-b), NEVER A (w-a)!
      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      // Pending queue MUST now be [C, A]
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-c', 'w-a']);
      expect(component.pendingQueue().map((c) => c.entry.pendingQueueSequence)).toEqual([3, 4]);
    });

    it('Duplicate card prevention: repeated ratings of A (Again, Hard, Again) never create duplicate items in pendingQueue', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      // 1. Rate A AGAIN -> goes to tail
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 3,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Current is B. Pending has [A]
      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      const occurrencesA1 = component.pendingQueue().filter((c) => c.entry.wordId === 'w-a').length;
      expect(occurrencesA1).toBe(1);

      // 2. Rate B GOOD -> graduates to REVIEW
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-b',
          status: 'KNOWN',
          srsState: 'REVIEW',
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      // Current is now A (sole card left in session)
      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      // 3. Rate A HARD -> reinserts A
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          intervalSeconds: 900,
        } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('HARD');
      fixture.detectChanges();

      // As sole card, A is presented again, pendingQueue should have 0 items (not duplicates)
      expect(component.currentCard()?.entry.wordId).toBe('w-a');
      expect(component.pendingQueue().filter((c) => c.entry.wordId === 'w-a').length).toBe(0);
    });

    it('Single pending card exception: sole card in session repeats immediately within learn-ahead window', () => {
      const soleCard: PreparedReviewEntry = {
        wordId: 'w-sole',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [soleCard],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-sole');

      // Rate AGAIN -> single pending card reinserts and repeats immediately
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-sole',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 2,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Immediate repeat allowed for sole card!
      expect(component.currentCard()?.entry.wordId).toBe('w-sole');
      expect(component.revealed()).toBe(false);
    });
  });

  describe('Fase 14.3.6.2 — Remove Artificial Last-Rated Block / Select First Eligible FIFO', () => {
    it('Case A & E: When all B, C, A are eligible, next card is B and queue stays [C, A] in FIFO sequence', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      // Rate A AGAIN -> server assigns pendingQueueSequence: 4, nextReviewAt: now + 10m (eligible)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Next is B (seq 2), queue has [C (seq 3), A (seq 4)]
      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-c', 'w-a']);
      expect(component.pendingQueue().map((c) => c.entry.pendingQueueSequence)).toEqual([3, 4]);
    });

    it('Case B: When B is +30m, C is +25m, and A is +10m, next card is A (NO waiting screen)', () => {
      const now = Date.now();
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(now - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(now + 30 * 60 * 1000).toISOString(), // +30m: NOT eligible
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(now + 25 * 60 * 1000).toISOString(), // +25m: NOT eligible
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      // Rate A AGAIN -> server assigns pendingQueueSequence: 4, nextReviewAt: now + 10m (ELIGIBLE!)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(now + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // Because B (+30m) and C (+25m) are NOT eligible, A (+10m) MUST be selected!
      // NO artificial last-rated block! NO waiting screen!
      expect(component.isWaitingForFutureLearning()).toBe(false);
      expect(component.currentCard()?.entry.wordId).toBe('w-a');
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-b', 'w-c']);
    });

    it('Case C: Single pending card A +10m repeats immediately via learn-ahead', () => {
      const now = Date.now();
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(now - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 2,
          nextReviewAt: new Date(now + 10 * 60 * 1000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.isWaitingForFutureLearning()).toBe(false);
      expect(component.currentCard()?.entry.wordId).toBe('w-a');
    });

    it('Case D: When all pending cards are >20m (B +35m, C +25m, A +30m), shows waiting state', () => {
      const now = Date.now();
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(now - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(now + 35 * 60 * 1000).toISOString(), // +35m
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(now + 25 * 60 * 1000).toISOString(), // +25m
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      // Rate A AGAIN with nextReviewAt = +30m (> 20m)
      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(now + 30 * 60 * 1000).toISOString(),
          intervalSeconds: 1800,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('AGAIN');
      fixture.detectChanges();

      // None of B (+35m), C (+25m), A (+30m) are eligible <= now + 20m
      // Must show waiting state!
      expect(component.currentCard()).toBeNull();
      expect(component.isWaitingForFutureLearning()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Próximo repaso en');
    });

    it('Case F: Rate A HARD with seq4 -> queue stays [B (seq2), C (seq3), A (seq4)]', () => {
      const cardA: PreparedReviewEntry = {
        wordId: 'w-a',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 1,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardB: PreparedReviewEntry = {
        wordId: 'w-b',
        word: 'house',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 2,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };
      const cardC: PreparedReviewEntry = {
        wordId: 'w-c',
        word: 'river',
        language: 'en',
        status: 'LEARNING',
        srsState: 'LEARNING',
        pendingQueueSequence: 3,
        nextReviewAt: new Date(Date.now() - 1000).toISOString(),
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 3,
          totalReviewableCount: 3,
          dailyComplete: false,
          entries: [],
          learnAheadEntries: [cardA, cardB, cardC],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-a',
          status: 'LEARNING',
          srsState: 'LEARNING',
          pendingQueueSequence: 4,
          nextReviewAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          intervalSeconds: 900,
        } as ReviewResult)
      );

      component.revealMeaning();
      component.selectRating('HARD');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      expect(component.pendingQueue().map((c) => c.entry.wordId)).toEqual(['w-c', 'w-a']);
      expect(component.pendingQueue().map((c) => c.entry.pendingQueueSequence)).toEqual([3, 4]);
    });
  });

  describe('FASE 14.3.8: Binary Again/Good UI + Auto Audio + Spanish Meaning', () => {
    it('24: audioUrl arrives late -> word audio plays once and is not dropped or prematurely consumed', () => {
      let dictionarySubscriber: any;
      dictionaryServiceMock.lookupWord.mockReturnValue({
        pipe: () => ({
          subscribe: (sub: any) => {
            dictionarySubscriber = sub;
            return { unsubscribe: vi.fn() };
          },
        }),
      });

      const cardLate: PreparedReviewEntry = {
        wordId: 'w-late',
        word: 'serendipity',
        language: 'en',
        status: 'LEARNING',
      };

      let audioPlayCount = 0;
      class LateAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => {
          audioPlayCount++;
          return Promise.resolve();
        });
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', LateAudioMock);

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [cardLate],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-late');
      expect(audioPlayCount).toBe(0);

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'serendipity',
        normalizedWord: 'serendipity',
        translation: 'hallazgo afortunado',
        phonetic: null,
        audioUrl: 'https://example.com/audio/serendipity.mp3',
        meanings: [],
      });
      dictionarySubscriber.next('<xml></xml>');
      fixture.detectChanges();

      expect(audioPlayCount).toBe(1);
    });

    it('25: example arrives late after user reveals -> narrationService.play(example) called once', () => {
      let dictionarySubscriber: any;
      dictionaryServiceMock.lookupWord.mockReturnValue({
        pipe: () => ({
          subscribe: (sub: any) => {
            dictionarySubscriber = sub;
            return { unsubscribe: vi.fn() };
          },
        }),
      });

      const cardLateExample: PreparedReviewEntry = {
        wordId: 'w-late-ex',
        word: 'journey',
        language: 'en',
        status: 'LEARNING',
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [cardLateExample],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      component.revealMeaning();
      fixture.detectChanges();
      expect(component.revealed()).toBe(true);
      expect(narrationMock.play).not.toHaveBeenCalled();

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'journey',
        normalizedWord: 'journey',
        translation: 'viaje',
        phonetic: null,
        audioUrl: 'https://example.com/audio/journey.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'Traveling from one place to another.',
                example: 'A magnificent journey across mountains.',
                exampleTranslation: 'Un magnífico viaje a través de montañas.',
              },
            ],
          },
        ],
      });

      dictionarySubscriber.next('<xml></xml>');
      fixture.detectChanges();

      expect(narrationMock.play).toHaveBeenCalledWith(
        'A magnificent journey across mountains.',
        'en-US'
      );
      expect(narrationMock.play).toHaveBeenCalledTimes(1);
    });

    it('26: stale lookup from previous presentation is discarded and does not overwrite current card or play audio', () => {
      let cardASubscriber: any;
      dictionaryServiceMock.lookupWord.mockImplementation((word: string) => {
        if (word === 'cardA') {
          return {
            pipe: () => ({
              subscribe: (sub: any) => {
                cardASubscriber = sub;
                return { unsubscribe: vi.fn() };
              },
            }),
          };
        }
        return of('<xml></xml>');
      });

      let playedSrc = '';
      class StaleAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => {
          playedSrc = this.src;
          return Promise.resolve();
        });
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', StaleAudioMock);

      const cardA: PreparedReviewEntry = { wordId: 'w-a', word: 'cardA', language: 'en', status: 'LEARNING' };
      const cardB: PreparedReviewEntry = { wordId: 'w-b', word: 'cardB', language: 'en', status: 'LEARNING' };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          entries: [cardA, cardB],
        })
      );

      component.startSession(15);
      fixture.detectChanges();
      expect(component.currentCard()?.entry.wordId).toBe('w-a');

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'cardB',
        normalizedWord: 'cardB',
        translation: 'tarjeta B',
        phonetic: null,
        audioUrl: 'https://example.com/audio/cardB.mp3',
        meanings: [],
      });

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-a', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.revealMeaning();
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      expect(playedSrc).toContain('cardB.mp3');

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'cardA',
        normalizedWord: 'cardA',
        translation: 'tarjeta A',
        phonetic: null,
        audioUrl: 'https://example.com/audio/cardA.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'def A', example: 'example A' }],
          },
        ],
      });
      cardASubscriber.next('<xml></xml>');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-b');
      expect(component.spanishMeaning).toBe('tarjeta B');
      expect(playedSrc).not.toContain('cardA.mp3');
      expect(narrationMock.play).not.toHaveBeenCalledWith('example A', 'en-US');
    });

    it('27: word audio and example audio do NOT repeat on template rerenders or signal recomputations', () => {
      let audioPlayCount = 0;
      class RerenderAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => {
          audioPlayCount++;
          return Promise.resolve();
        });
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', RerenderAudioMock);

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'resilience',
        normalizedWord: 'resilience',
        translation: 'resiliencia',
        phonetic: null,
        audioUrl: 'https://example.com/audio/resilience.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'toughness', example: 'Great resilience shown.' }],
          },
        ],
      });

      component.startSession(15);
      fixture.detectChanges();

      expect(audioPlayCount).toBe(1);

      fixture.detectChanges();
      fixture.detectChanges();
      fixture.detectChanges();

      expect(audioPlayCount).toBe(1);

      component.revealMeaning();
      fixture.detectChanges();

      expect(narrationMock.play).toHaveBeenCalledTimes(1);

      fixture.detectChanges();
      fixture.detectChanges();

      expect(narrationMock.play).toHaveBeenCalledTimes(1);
    });

    it('28: card returning after Again is a new presentation: word audio plays again, revealed=false, example on reveal', () => {
      let audioPlayCount = 0;
      class AgainAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => {
          audioPlayCount++;
          return Promise.resolve();
        });
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', AgainAudioMock);

      const singleCard: PreparedReviewEntry = {
        wordId: 'w-repeat',
        word: 'serendipity',
        language: 'en',
        status: 'LEARNING',
      };

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'serendipity',
        normalizedWord: 'serendipity',
        translation: 'hallazgo afortunado',
        phonetic: null,
        audioUrl: 'https://example.com/audio/serendipity.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'luck', example: 'A moment of serendipity.' }],
          },
        ],
      });

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [singleCard],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      expect(audioPlayCount).toBe(1);
      expect(component.revealed()).toBe(false);

      component.revealMeaning();
      fixture.detectChanges();
      expect(component.revealed()).toBe(true);
      expect(narrationMock.play).toHaveBeenCalledTimes(1);

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-repeat',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-repeat');
      expect(component.revealed()).toBe(false);
      expect(audioPlayCount).toBe(2);
      expect(narrationMock.play).toHaveBeenCalledTimes(1);

      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      expect(component.spanishMeaning).toBe('hallazgo afortunado');
      expect(narrationMock.play).toHaveBeenCalledTimes(2);
    });

    it('29: DOM renders exactly two rating buttons (Again, Good), Hard and Easy are absent, binary grid layout', () => {
      component.revealMeaning();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const ratingBtns = compiled.querySelectorAll('.rating-btn');
      expect(ratingBtns.length).toBe(2);

      expect(compiled.querySelector('.btn-again')).toBeTruthy();
      expect(compiled.querySelector('.btn-good')).toBeTruthy();
      expect(compiled.querySelector('.btn-hard')).toBeNull();
      expect(compiled.querySelector('.btn-easy')).toBeNull();

      const grid = compiled.querySelector('.rating-buttons-grid');
      expect(grid?.className).toContain('grid-cols-2');
      expect(grid?.className).not.toContain('grid-cols-4');
    });

    it('30: displays dynamic intervals from backend (10m, 1d vs mature 10m, 1.9mo)', () => {
      const cardFixture1: PreparedReviewEntry = {
        wordId: 'w-f1',
        word: 'fresh',
        language: 'en',
        status: 'LEARNING',
        ratingOptions: [
          { rating: 'AGAIN', intervalSeconds: 600 },
          { rating: 'GOOD', intervalSeconds: 86400 },
        ],
      };

      const cardFixtureMature: PreparedReviewEntry = {
        wordId: 'w-mat',
        word: 'mature',
        language: 'en',
        status: 'LEARNING',
        ratingOptions: [
          { rating: 'AGAIN', intervalSeconds: 600 },
          { rating: 'GOOD', intervalSeconds: 4924800 }, // 57d -> 1.9mo
        ],
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 2,
          totalReviewableCount: 2,
          entries: [cardFixture1, cardFixtureMature],
        })
      );

      component.startSession(15);
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.getFormattedInterval('AGAIN')).toBe('10m');
      expect(component.getFormattedInterval('GOOD')).toBe('1d');
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.btn-again')?.textContent).toContain('10m');
      expect(compiled.querySelector('.btn-good')?.textContent).toContain('1d');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-f1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.selectRating('GOOD');
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-mat');
      expect(component.getFormattedInterval('AGAIN')).toBe('10m');
      expect(component.getFormattedInterval('GOOD')).toBe('1.9mo');
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.btn-again')?.textContent).toContain('10m');
      expect(compiled.querySelector('.btn-good')?.textContent).toContain('1.9mo');
    });

    it('31: mature card with Good 1.9mo resets to Good 1d after Again when backend returns fresh options', () => {
      const matureCard: PreparedReviewEntry = {
        wordId: 'w-mat-fail',
        word: 'ancient',
        language: 'en',
        status: 'KNOWN',
        srsState: 'REVIEW',
        ratingOptions: [
          { rating: 'AGAIN', intervalSeconds: 600 },
          { rating: 'GOOD', intervalSeconds: 4924800 },
        ],
      };

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [matureCard],
        })
      );

      component.startSession(15);
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.getFormattedInterval('GOOD')).toBe('1.9mo');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-mat-fail',
          status: 'LEARNING',
          srsState: 'RELEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
          ratingOptions: [
            { rating: 'AGAIN', intervalSeconds: 600 },
            { rating: 'GOOD', intervalSeconds: 86400 },
          ],
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-mat-fail');
      component.revealMeaning();
      fixture.detectChanges();

      expect(component.getFormattedInterval('GOOD')).toBe('1d');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.btn-good')?.textContent).toContain('1d');
      expect(compiled.querySelector('.btn-good')?.textContent).not.toContain('1.9mo');
    });

    it('32: Spanish meaning is hidden before reveal, visible after reveal, and survives Again', () => {
      const meaningCard: PreparedReviewEntry = {
        wordId: 'w-real-meaning',
        word: 'meaning',
        language: 'en',
        status: 'LEARNING',
      };

      dictionaryServiceMock.parseLookupWordResponse.mockReturnValue({
        word: 'meaning',
        normalizedWord: 'meaning',
        translation: 'Significado',
        phonetic: null,
        audioUrl: 'https://example.com/audio/meaning.mp3',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'the idea that is represented by a word, phrase, etc.',
                example: 'What is the precise meaning of this word?',
                exampleTranslation: '¿Cuál es el significado exacto de esta palabra?',
              },
            ],
          },
        ],
      });

      vocabularyServiceMock.prepareVocabularyReview.mockReturnValue(
        of({
          dueCount: 1,
          totalReviewableCount: 1,
          entries: [meaningCard],
        })
      );

      component.startSession(15);
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Significado');

      component.revealMeaning();
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Significado');

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({
          wordId: 'w-real-meaning',
          status: 'LEARNING',
          srsState: 'LEARNING',
          nextReviewAt: new Date(Date.now() + 600000).toISOString(),
          intervalSeconds: 600,
        } as ReviewResult)
      );

      component.selectRating('AGAIN');
      fixture.detectChanges();

      expect(component.currentCard()?.entry.wordId).toBe('w-real-meaning');
      expect(component.revealed()).toBe(false);
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Significado');

      component.revealMeaning();
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Significado');
    });

    it('33: audio playback failure or narration error does NOT break review flow', async () => {
      class FailingAudioMock {
        currentTime = 0;
        readonly play = vi.fn(() => Promise.reject(new Error('Browser blocked autoplay')));
        readonly pause = vi.fn();
        constructor(readonly src: string) {}
      }
      vi.stubGlobal('Audio', FailingAudioMock);
      narrationMock.play.mockImplementation(() => {
        throw new Error('TTS synthesis failed');
      });

      component.startSession(15);
      fixture.detectChanges();

      expect(component.currentCard()).not.toBeNull();
      expect(component.completed()).toBe(false);

      component.revealMeaning();
      fixture.detectChanges();

      expect(component.revealed()).toBe(true);
      expect(component.completed()).toBe(false);

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );
      component.selectRating('GOOD');
      fixture.detectChanges();

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalled();
    });
  });

  describe('FASE 14.3.9: VocabularyReview ratings do NOT call status mutation API', () => {
    it('rating AGAIN calls recordVocabularyReview and does NOT call setVocabularyStatus', () => {
      component.startSession(15);
      fixture.detectChanges();
      component.revealMeaning();
      fixture.detectChanges();

      component.selectRating('AGAIN');

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'AGAIN');
      expect(vocabularyServiceMock.setVocabularyStatus).not.toHaveBeenCalled();
    });

    it('rating GOOD calls recordVocabularyReview and does NOT call setVocabularyStatus', () => {
      component.startSession(15);
      fixture.detectChanges();
      component.revealMeaning();
      fixture.detectChanges();

      vocabularyServiceMock.recordVocabularyReview.mockReturnValue(
        of({ wordId: 'w-1', status: 'KNOWN', srsState: 'REVIEW' } as ReviewResult)
      );

      component.selectRating('GOOD');

      expect(vocabularyServiceMock.recordVocabularyReview).toHaveBeenCalledWith('w-1', 'GOOD');
      expect(vocabularyServiceMock.setVocabularyStatus).not.toHaveBeenCalled();
    });
  });
});

