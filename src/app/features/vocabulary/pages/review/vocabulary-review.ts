import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import {
  DictionaryDefinition,
  DictionaryService,
  DictionaryWord,
} from '../../../../shared/services/dictionary';
import { NarrationService } from '../../../../shared/narration/narration.service';
import {
  PreparedReviewEntry,
  RatingOption,
  ReviewAssessment,
  ReviewBatchSize,
  ReviewRating,
  ReviewResultItem,
} from '../../models/vocabulary.models';
import { VocabularyService } from '../../services/vocabulary.service';
import { formatIntervalSeconds } from '../../utils/interval-formatter';
import { parseSrsDate } from '../../utils/srs-date-parser';
import { buildReviewQueues } from '../../utils/review-queue-builder';

export const LEARN_AHEAD_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

export interface ReviewSessionItem {
  entry: PreparedReviewEntry;
  isAgainRepeat: boolean;
  isReinforcement?: boolean;
  isLearnAhead?: boolean;
  baseWordNumber: number;
  dueTime?: number | null;
  dictionaryWord?: DictionaryWord | null;
}

export interface LearningPoolCard {
  entry: PreparedReviewEntry;
  dueTime: number;
  baseWordNumber: number;
  isAgainRepeat: boolean;
  isLearnAhead?: boolean;
}

@Component({
  selector: 'app-vocabulary-review',
  imports: [RouterLink],
  templateUrl: './vocabulary-review.html',
  styleUrl: './vocabulary-review.css',
})
export class VocabularyReview implements OnInit {
  private readonly vocabularyService = inject(VocabularyService);
  private readonly dictionaryService = inject(DictionaryService);
  private readonly narrationService = inject(NarrationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private audioInstance: HTMLAudioElement | null = null;
  private scheduledTimerId: ReturnType<typeof setTimeout> | null = null;
  private isReconciling = false;
  private hasReconciledForEmpty = false;
  private readonly lexicalDataCache = new Map<string, DictionaryWord>();

  private presentationSequence = 0;
  private lastPlayedWordPresentationId = -1;
  private lastPlayedExamplePresentationId = -1;

  // Session configuration
  readonly sessionStarted = signal(false);
  readonly selectedSize = signal<number>(15);
  readonly availableSizes: ReviewBatchSize[] = [10, 15, 20, 30];

  // Backend session metrics
  readonly dueCount = signal(0);
  readonly totalReviewableCount = signal(0);
  readonly dailyLimit = signal(15);
  readonly dailyBaseCompleted = signal(0);
  readonly localBaseIntroducedCount = signal(0);
  readonly dailyBaseRemaining = signal(0);
  readonly pendingLearningCount = signal(0);
  readonly dailyComplete = signal(false);

  // Active queues & review state
  readonly loadingSession = signal(false);
  readonly sessionLoadError = signal<string | null>(null);
  readonly baseQueue = signal<ReviewSessionItem[]>([]);
  readonly pendingQueue = signal<ReviewSessionItem[]>([]);
  readonly currentCard = signal<ReviewSessionItem | null>(null);
  readonly allInitialCards = signal<ReviewSessionItem[]>([]);
  readonly completed = signal(false);
  readonly baseTotalWords = signal(0);
  readonly reviewedDistinctWordIds = signal<Set<string>>(new Set());
  readonly currentIndex = signal(0);

  // Backwards compatibility computed signals
  readonly dueQueue = computed(() => this.baseQueue());
  readonly learningPool = computed<LearningPoolCard[]>(() =>
    this.pendingQueue().map((item) => ({
      entry: item.entry,
      dueTime: item.dueTime ?? 0,
      baseWordNumber: item.baseWordNumber,
      isAgainRepeat: item.isAgainRepeat,
      isLearnAhead: item.isLearnAhead,
    }))
  );
  readonly sessionCards = computed(() => this.allInitialCards());
  readonly futureLearningQueue = computed(() => this.learningPool());
  readonly learnAheadPool = computed(() =>
    this.learningPool().filter(
      (c) => c.dueTime <= Date.now() + LEARN_AHEAD_WINDOW_MS
    )
  );

  // Derived session properties
  readonly displayDailyLimit = computed(() => this.dailyLimit());
  readonly displayCompleted = computed(() =>
    Math.min(
      this.dailyBaseCompleted() + this.localBaseIntroducedCount(),
      this.displayDailyLimit()
    )
  );
  readonly totalWords = computed(() => this.baseTotalWords() || this.displayDailyLimit());
  readonly currentWord = computed(() => this.currentCard()?.entry ?? null);
  readonly isAgainRepeat = computed(
    () => this.currentCard()?.isAgainRepeat ?? false
  );
  readonly isCurrentReinforcement = computed(
    () => this.isAgainRepeat()
  );
  readonly isLearnAhead = computed(
    () => this.currentCard()?.isLearnAhead ?? false
  );

  readonly totalUpcomingCount = computed(() => this.pendingQueue().length);

  readonly progressPercentage = computed(() => {
    const limit = this.displayDailyLimit();
    if (limit === 0) return 100;
    return Math.min(100, Math.round((this.displayCompleted() / limit) * 100));
  });

  readonly nextPendingDueTime = computed(() => {
    const queue = this.pendingQueue();
    const dueTimes = queue
      .map((c) => c.dueTime ?? (c.entry.nextReviewAt ? parseSrsDate(c.entry.nextReviewAt) : null))
      .filter((t): t is number => t !== null);
    if (dueTimes.length === 0) return null;
    return Math.min(...dueTimes);
  });

  readonly nextPendingMinutes = computed(() => {
    const due = this.nextPendingDueTime();
    if (!due) return null;
    const diffMs = due - Date.now();
    return Math.max(1, Math.ceil(diffMs / 60000));
  });

  readonly isWaitingForFutureLearning = computed(() => {
    if (
      !this.sessionStarted() ||
      this.loadingSession() ||
      this.sessionLoadError() ||
      this.completed()
    ) {
      return false;
    }
    if (this.currentCard() !== null) return false;
    if (this.baseQueue().length > 0) return false;

    const windowLimit = Date.now() + LEARN_AHEAD_WINDOW_MS;
    const hasEligiblePending = this.pendingQueue().some((c) => {
      const dueTime =
        c.dueTime ?? (c.entry.nextReviewAt ? parseSrsDate(c.entry.nextReviewAt) : null);
      return dueTime == null || dueTime <= windowLimit;
    });

    const hasPendingLearning =
      this.pendingQueue().length > 0 || this.pendingLearningCount() > 0;

    return !hasEligiblePending && hasPendingLearning && !this.dailyComplete();
  });

  readonly isDailyComplete = computed(
    () =>
      this.completed() &&
      this.currentCard() === null &&
      this.baseQueue().length === 0 &&
      this.pendingQueue().length === 0 &&
      this.pendingLearningCount() === 0
  );

  readonly isEmptySession = computed(
    () =>
      this.sessionStarted() &&
      !this.loadingSession() &&
      !this.sessionLoadError() &&
      this.currentCard() === null &&
      this.baseQueue().length === 0 &&
      this.pendingQueue().length === 0 &&
      this.displayCompleted() === 0 &&
      this.reviewedDistinctWordIds().size === 0 &&
      !this.completed() &&
      !this.dailyComplete() &&
      this.pendingLearningCount() === 0
  );

  readonly hasMoreDueWords = computed(() => {
    const reviewed = this.reviewedDistinctWordIds().size;
    return this.dueCount() > reviewed || this.totalReviewableCount() > reviewed;
  });

  // Current item reveal & dictionary state
  readonly revealed = signal(false);
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly dictionaryWord = signal<DictionaryWord | null>(null);
  readonly audioError = signal<string | null>(null);

  // Mutation & feedback state
  readonly mutationPending = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly lastAttemptedRating = signal<ReviewRating | null>(null);

  // Results of the session
  readonly sessionResults = signal<ReviewResultItem[]>([]);
  readonly againCount = computed(
    () => this.sessionResults().filter((item) => item.rating === 'AGAIN').length
  );
  readonly hardCount = computed(
    () => this.sessionResults().filter((item) => item.rating === 'HARD').length
  );
  readonly goodCount = computed(
    () => this.sessionResults().filter((item) => item.rating === 'GOOD').length
  );
  readonly easyCount = computed(
    () => this.sessionResults().filter((item) => item.rating === 'EASY').length
  );
  readonly forgotCount = computed(() => this.againCount());
  readonly struggledCount = computed(() => this.hardCount());
  readonly rememberedCount = computed(() => this.goodCount() + this.easyCount());

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopAudio();
      this.clearScheduledTimer();
    });
  }

  ngOnInit(): void {
    this.startSession(15);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (
      this.completed() ||
      this.loadingSession() ||
      this.mutationPending() ||
      !this.sessionStarted()
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (!this.revealed()) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.revealMeaning();
      }
    } else {
      if (event.key === '1') {
        event.preventDefault();
        this.selectRating('AGAIN');
      } else if (event.key === '2') {
        event.preventDefault();
        this.selectRating('GOOD');
      }
      // Keys 3 and 4 have NO rating action.
    }
  }

  @HostListener('document:visibilitychange')
  handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.checkDueFutureCards();
    }
  }

  selectSize(size: number): void {
    this.selectedSize.set(size);
  }

  startSession(size = 15): void {
    this.sessionStarted.set(true);
    this.loadingSession.set(true);
    this.sessionLoadError.set(null);
    this.completed.set(false);
    this.sessionResults.set([]);
    this.reviewedDistinctWordIds.set(new Set());
    this.currentIndex.set(0);
    this.currentCard.set(null);
    this.baseQueue.set([]);
    this.pendingQueue.set([]);
    this.localBaseIntroducedCount.set(0);
    this.revealed.set(false);
    this.dictionaryWord.set(null);
    this.lookupError.set(null);
    this.mutationError.set(null);
    this.audioError.set(null);
    this.hasReconciledForEmpty = false;
    this.stopAudio();
    this.clearScheduledTimer();

    this.vocabularyService
      .prepareVocabularyReview(size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.dueCount.set(session.dueCount);
          this.totalReviewableCount.set(session.totalReviewableCount);
          this.dailyLimit.set(session.dailyLimit ?? 15);
          this.dailyBaseCompleted.set(session.dailyBaseCompleted ?? 0);
          this.localBaseIntroducedCount.set(0);
          this.baseTotalWords.set(session.entries?.length ?? 0);
          this.dailyBaseRemaining.set(session.dailyBaseRemaining ?? 0);
          this.pendingLearningCount.set(session.pendingLearningCount ?? 0);
          this.dailyComplete.set(session.dailyComplete ?? false);

          const { baseQueue, pendingQueue } = buildReviewQueues(session);

          // Direct route protection: if session is already complete and no cards remain
          if (
            session.dailyComplete &&
            (session.pendingLearningCount ?? 0) === 0 &&
            baseQueue.length === 0 &&
            pendingQueue.length === 0
          ) {
            this.completed.set(true);
            this.loadingSession.set(false);
            return;
          }

          const baseCards: ReviewSessionItem[] = baseQueue.map((entry, index) => ({
            entry,
            isAgainRepeat: false,
            isReinforcement: false,
            isLearnAhead: false,
            baseWordNumber: (session.dailyBaseCompleted ?? 0) + index + 1,
            dueTime: parseSrsDate(entry.nextReviewAt),
            dictionaryWord:
              this.lexicalDataCache.get(entry.wordId) ??
              this.lexicalDataCache.get(entry.word.toLowerCase()) ??
              null,
          }));
          this.baseQueue.set(baseCards);

          const pendingCards: ReviewSessionItem[] = pendingQueue.map((entry) => ({
            entry,
            isAgainRepeat: false,
            isReinforcement: true,
            isLearnAhead: false,
            baseWordNumber: 0,
            dueTime: parseSrsDate(entry.nextReviewAt),
            dictionaryWord:
              this.lexicalDataCache.get(entry.wordId) ??
              this.lexicalDataCache.get(entry.word.toLowerCase()) ??
              null,
          }));
          this.pendingQueue.set(pendingCards);

          this.allInitialCards.set([...baseCards, ...pendingCards]);
          this.loadingSession.set(false);

          this.selectNextCard();
        },
        error: () => {
          this.sessionLoadError.set(
            'No pudimos cargar la sesión de repaso. Intenta nuevamente.'
          );
          this.loadingSession.set(false);
        },
      });
  }

  selectNextCard(): void {
    const now = Date.now();

    // Phase A: Base Cards (pendingQueueSequence == null, baseOrder != null)
    // Study by baseOrder ASC until baseQueue is empty.
    if (this.baseQueue().length > 0) {
      const [nextCard, ...rest] = this.baseQueue();
      this.baseQueue.set(rest);
      this.currentCard.set(nextCard);
      this.resetCardState(nextCard);
      return;
    }

    // Phase B: Pending Learning (pendingQueueSequence != null)
    // pendingQueue is sorted EXCLUSIVELY by pendingQueueSequence ASC (FIFO).
    const pending = this.pendingQueue();
    const windowLimit = now + LEARN_AHEAD_WINDOW_MS;

    if (pending.length === 0) {
      this.currentCard.set(null);
      this.reconcileWithBackend();
      return;
    }

    // Automatically select the first eligible card in FIFO order (pendingQueueSequence ASC).
    const eligibleIndex = pending.findIndex((c) => {
      const dueTime =
        c.dueTime ?? (c.entry.nextReviewAt ? parseSrsDate(c.entry.nextReviewAt) : null);
      return dueTime == null || dueTime <= windowLimit;
    });

    if (eligibleIndex !== -1) {
      const chosen = pending[eligibleIndex];
      const isAhead = (chosen.dueTime != null && chosen.dueTime > now) || chosen.isLearnAhead;
      const cardToSet: ReviewSessionItem = {
        ...chosen,
        isLearnAhead: isAhead,
      };
      const newPending = [...pending.slice(0, eligibleIndex), ...pending.slice(eligibleIndex + 1)];
      this.pendingQueue.set(newPending);
      this.currentCard.set(cardToSet);
      this.resetCardState(cardToSet);
      return;
    }

    // If pending cards remain but none are eligible yet (all > now + 20m):
    this.currentCard.set(null);
    this.scheduleNextDueCheck();
  }

  private reconcileWithBackend(): void {
    if (this.isReconciling || this.hasReconciledForEmpty) {
      if (!this.isReconciling && this.hasReconciledForEmpty) {
        if (
          this.pendingQueue().length === 0 &&
          this.pendingLearningCount() === 0 &&
          (this.dailyComplete() || this.displayCompleted() > 0)
        ) {
          this.completed.set(true);
        }
      }
      return;
    }

    this.isReconciling = true;
    this.vocabularyService
      .prepareVocabularyReview(this.selectedSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.isReconciling = false;
          this.hasReconciledForEmpty = true;

          this.dueCount.set(session.dueCount);
          this.totalReviewableCount.set(session.totalReviewableCount);
          this.dailyLimit.set(session.dailyLimit ?? 15);
          this.dailyBaseCompleted.set(session.dailyBaseCompleted ?? 0);
          this.localBaseIntroducedCount.set(0); // Reset local introduced count on backend sync
          this.dailyBaseRemaining.set(session.dailyBaseRemaining ?? 0);
          this.pendingLearningCount.set(session.pendingLearningCount ?? 0);
          this.dailyComplete.set(session.dailyComplete ?? false);

          const { baseQueue, pendingQueue } = buildReviewQueues(session);

          const baseCards: ReviewSessionItem[] = baseQueue.map((entry, index) => ({
            entry,
            isAgainRepeat: false,
            isReinforcement: false,
            isLearnAhead: false,
            baseWordNumber: (session.dailyBaseCompleted ?? 0) + index + 1,
            dueTime: parseSrsDate(entry.nextReviewAt),
            dictionaryWord:
              this.lexicalDataCache.get(entry.wordId) ??
              this.lexicalDataCache.get(entry.word.toLowerCase()) ??
              null,
          }));
          this.baseQueue.set(baseCards);

          const pendingCards: ReviewSessionItem[] = pendingQueue.map((entry) => ({
            entry,
            isAgainRepeat: false,
            isReinforcement: true,
            isLearnAhead: false,
            baseWordNumber: 0,
            dueTime: parseSrsDate(entry.nextReviewAt),
            dictionaryWord:
              this.lexicalDataCache.get(entry.wordId) ??
              this.lexicalDataCache.get(entry.word.toLowerCase()) ??
              null,
          }));
          this.pendingQueue.set(pendingCards);

          if (baseCards.length > 0 || pendingCards.length > 0) {
            this.hasReconciledForEmpty = false;
            this.selectNextCard();
            return;
          }

          if ((session.pendingLearningCount ?? 0) > 0) {
            this.currentCard.set(null);
            return;
          }

          if (session.dailyComplete || this.displayCompleted() > 0) {
            this.completed.set(true);
          }
        },
        error: () => {
          this.isReconciling = false;
          this.hasReconciledForEmpty = true;
          if (this.displayCompleted() > 0 || this.dailyComplete()) {
            this.completed.set(true);
          }
        },
      });
  }

  continueReviewing(): void {
    this.startSession(15);
  }

  readonly activeRatingOptions = computed<RatingOption[]>(() => {
    const card = this.currentCard();
    const options = card?.entry.ratingOptions;
    if (options && options.length > 0) {
      return options.filter((o) => o.rating === 'AGAIN' || o.rating === 'GOOD');
    }
    return [
      { rating: 'AGAIN', intervalSeconds: 600 },
      { rating: 'GOOD', intervalSeconds: 86400 },
    ];
  });

  get spanishMeaning(): string {
    const dict = this.dictionaryWord();
    if (!dict) return '';
    if (dict.translation && dict.translation.trim().length > 0) {
      return dict.translation.trim();
    }
    return '';
  }

  get primaryDefinition(): DictionaryDefinition | null {
    const dict = this.dictionaryWord();
    if (!dict) return null;
    for (const meaning of dict.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (def.definition || def.example) {
          return def;
        }
      }
    }
    return null;
  }

  getPrimaryExample(): string | null {
    const dict = this.dictionaryWord();
    if (!dict) return null;
    for (const meaning of dict.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (def.example && def.example.trim().length > 0) {
          return def.example.trim();
        }
      }
    }
    return null;
  }

  private loadDictionaryForCurrentCard(
    presentationId: number = this.presentationSequence,
    expectedWordId?: string
  ): void {
    const current = this.currentCard();
    const word = current?.entry;
    if (!word) return;

    const targetWordId = expectedWordId ?? word.wordId;

    const cached =
      this.lexicalDataCache.get(word.wordId) ??
      this.lexicalDataCache.get(word.word.toLowerCase());
    if (cached) {
      this.dictionaryWord.set(cached);
      this.lookupLoading.set(false);
      if (!current.dictionaryWord) {
        current.dictionaryWord = cached;
      }
      if (
        this.presentationSequence === presentationId &&
        this.currentCard()?.entry.wordId === targetWordId
      ) {
        if (this.revealed()) {
          this.autoplayExampleAudio(presentationId);
        } else {
          this.autoplayWordAudio(presentationId);
        }
      }
      return;
    }

    this.lookupLoading.set(true);
    this.lookupError.set(null);

    this.dictionaryService
      .lookupWord(word.word)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (responseXml) => {
          // Section 5: Stale async lookup protection
          if (
            this.presentationSequence !== presentationId ||
            this.currentCard()?.entry.wordId !== targetWordId
          ) {
            return;
          }

          try {
            const parsed =
              this.dictionaryService.parseLookupWordResponse(responseXml);
            const hasContent =
              (parsed.translation && parsed.translation.trim().length > 0) ||
              (parsed.meanings && parsed.meanings.length > 0) ||
              Boolean(parsed.audioUrl);

            if (hasContent) {
              this.dictionaryWord.set(parsed);
              this.lexicalDataCache.set(word.wordId, parsed);
              this.lexicalDataCache.set(word.word.toLowerCase(), parsed);
              const active = this.currentCard();
              if (active && active.entry.wordId === targetWordId) {
                active.dictionaryWord = parsed;
              }

              // Section 8 & 9: Autoplay matching current revealed state
              if (this.revealed()) {
                this.autoplayExampleAudio(presentationId);
              } else {
                this.autoplayWordAudio(presentationId);
              }
            } else {
              this.lookupError.set('No pudimos cargar el significado.');
            }
          } catch {
            this.lookupError.set('No pudimos cargar el significado.');
          } finally {
            this.lookupLoading.set(false);
          }
        },
        error: () => {
          if (
            this.presentationSequence === presentationId &&
            this.currentCard()?.entry.wordId === targetWordId
          ) {
            this.lookupError.set('No pudimos cargar el significado.');
            this.lookupLoading.set(false);
          }
        },
      });
  }

  revealMeaning(): void {
    if (this.revealed()) return;
    this.revealed.set(true);

    // Section 10: Cancel word audio before starting example audio
    this.stopAudio();

    // Section 8: Autoplay example audio on reveal if available
    this.autoplayExampleAudio(this.presentationSequence);

    if (!this.dictionaryWord() && !this.lookupLoading()) {
      this.loadDictionaryForCurrentCard(
        this.presentationSequence,
        this.currentCard()?.entry.wordId
      );
    }
  }

  retryLookup(): void {
    const word = this.currentWord();
    if (word) {
      this.lexicalDataCache.delete(word.wordId);
      this.lexicalDataCache.delete(word.word.toLowerCase());
      const current = this.currentCard();
      if (current) {
        current.dictionaryWord = null;
      }
    }
    this.dictionaryWord.set(null);
    this.loadDictionaryForCurrentCard(
      this.presentationSequence,
      this.currentCard()?.entry.wordId
    );
  }

  private autoplayWordAudio(presentationId: number): void {
    if (this.presentationSequence !== presentationId) return;
    if (this.revealed()) return;
    if (this.lastPlayedWordPresentationId === presentationId) return;

    const audioUrl = this.dictionaryWord()?.audioUrl;
    // Section 4: If no playable source exists yet, do NOT mark presentation as played
    if (!audioUrl) return;

    this.lastPlayedWordPresentationId = presentationId;

    this.stopAudio();
    try {
      this.audioInstance = new Audio(audioUrl);
      void this.audioInstance.play().catch(() => {
        // Autoplay blocked by browser policy or audio failure - review flow unaffected
      });
    } catch {
      // Ignored
    }
  }

  private autoplayExampleAudio(presentationId: number): void {
    if (this.presentationSequence !== presentationId) return;
    if (!this.revealed()) return;
    if (this.lastPlayedExamplePresentationId === presentationId) return;

    const exampleText = this.getPrimaryExample();
    // Section 8: If no example text exists yet, do NOT mark presentation as played
    if (!exampleText) return;

    this.lastPlayedExamplePresentationId = presentationId;

    this.stopAudio();
    try {
      this.narrationService.stop();
      this.narrationService.play(exampleText, 'en-US');
    } catch {
      // Ignored
    }
  }

  playAudio(): void {
    const audioUrl = this.dictionaryWord()?.audioUrl;
    if (!audioUrl) return;

    this.stopAudio();
    this.audioError.set(null);

    try {
      this.audioInstance = new Audio(audioUrl);
      void this.audioInstance.play().catch(() => {
        this.audioError.set('Audio no disponible');
      });
    } catch {
      this.audioError.set('Audio no disponible');
    }
  }

  playExampleAudio(): void {
    const exampleText = this.getPrimaryExample();
    if (!exampleText) return;

    this.stopAudio();
    try {
      this.narrationService.stop();
      this.narrationService.play(exampleText, 'en-US');
    } catch {
      // Ignored
    }
  }

  private stopAudio(): void {
    if (this.audioInstance) {
      try {
        this.audioInstance.pause();
      } catch {
        // Ignored
      }
      this.audioInstance = null;
    }
    try {
      this.narrationService.stop();
    } catch {
      // Ignored
    }
  }

  getRatingOption(rating: ReviewRating): RatingOption | undefined {
    return this.currentCard()?.entry.ratingOptions?.find(
      (opt) => opt.rating === rating
    );
  }

  getFormattedInterval(rating: ReviewRating): string {
    const opt = this.getRatingOption(rating);
    if (!opt) return '';
    return formatIntervalSeconds(opt.intervalSeconds);
  }

  selectRating(rating: ReviewRating): void {
    const card = this.currentCard();
    const word = card?.entry;
    if (!card || !word || this.mutationPending()) return;

    // Capture existing lexical data before mutation so it is never lost
    const existingLexical =
      card.dictionaryWord ??
      this.dictionaryWord() ??
      this.lexicalDataCache.get(word.wordId) ??
      this.lexicalDataCache.get(word.word.toLowerCase()) ??
      null;

    this.lastAttemptedRating.set(rating);
    this.mutationPending.set(true);
    this.mutationError.set(null);

    this.vocabularyService
      .recordVocabularyReview(word.wordId, rating)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.stopAudio();
          this.sessionResults.update((results) => [
            ...results,
            {
              word: word.word,
              previousStatus: word.status,
              targetStatus: result.status,
              rating,
            },
          ]);

          // Track base unique progress only for unintroduced base cards
          if (!card.isAgainRepeat && !card.isReinforcement) {
            this.localBaseIntroducedCount.update((c) => c + 1);
            this.reviewedDistinctWordIds.update((set) =>
              new Set(set).add(word.wordId)
            );
          }

          // Section 8 & 10: Fresh response metadata
          const updatedEntry: PreparedReviewEntry = {
            ...word,
            status: result.status,
            srsState: result.srsState ?? word.srsState,
            pendingQueueSequence: result.pendingQueueSequence ?? null,
            baseOrder: result.baseOrder ?? word.baseOrder,
            nextReviewAt: result.nextReviewAt ?? null,
            ratingOptions:
              result.ratingOptions && result.ratingOptions.length > 0
                ? result.ratingOptions
                : word.ratingOptions,
          };

          this.mutationPending.set(false);
          this.lastAttemptedRating.set(null);
          this.currentIndex.update((i) => i + 1);
          this.hasReconciledForEmpty = false;

          const now = Date.now();
          let nextDueTime = parseSrsDate(result.nextReviewAt);
          if (nextDueTime === null && result.intervalSeconds != null) {
            nextDueTime = now + result.intervalSeconds * 1000;
          } else if (nextDueTime === null) {
            nextDueTime = rating === 'AGAIN' ? now + 10 * 60 * 1000 : now + 15 * 60 * 1000;
          }

          // Rule: SrsState.REVIEW after GOOD/EASY -> card exits pendingQueue completely
          const isGraduated =
            result.srsState === 'REVIEW' ||
            (result.srsState !== 'LEARNING' &&
              result.srsState !== 'RELEARNING' &&
              (rating === 'GOOD' || rating === 'EASY'));

          if (isGraduated) {
            this.pendingQueue.update((queue) =>
              queue.filter((c) => c.entry.wordId !== word.wordId)
            );
          } else {
            // SrsState is LEARNING or RELEARNING:
            // Reinsert or update card in pendingQueue ordered by pendingQueueSequence ASC (tail insertion)
            const isAgain = rating === 'AGAIN' || Boolean(card.isAgainRepeat);
            const reinsertedItem: ReviewSessionItem = {
              entry: updatedEntry,
              dueTime: nextDueTime,
              baseWordNumber: card.baseWordNumber,
              isAgainRepeat: isAgain,
              isReinforcement: true,
              isLearnAhead: false,
              dictionaryWord: existingLexical,
            };

            this.pendingQueue.update((queue) => {
              const filtered = queue.filter((c) => c.entry.wordId !== word.wordId);
              if (reinsertedItem.entry.pendingQueueSequence == null) {
                const maxSeq = filtered.reduce(
                  (max, item) => Math.max(max, item.entry.pendingQueueSequence ?? 0),
                  0
                );
                reinsertedItem.entry.pendingQueueSequence = maxSeq + 1;
              }
              const combined = [...filtered, reinsertedItem];
              return combined.sort((a, b) => {
                const seqA = a.entry.pendingQueueSequence ?? 999999;
                const seqB = b.entry.pendingQueueSequence ?? 999999;
                return seqA - seqB;
              });
            });
          }

          // Invalidate cache in service so Mi vocabulario will get fresh state on return
          this.vocabularyService.invalidatePreparationCache();

          // Clear currentCard presentation before selecting next
          this.currentCard.set(null);

          // Select next card automatically (revealed will be reset to false)
          this.selectNextCard();
        },
        error: () => {
          this.mutationPending.set(false);
          this.mutationError.set('No pudimos guardar tu respuesta.');
        },
      });
  }

  /** Legacy adapter for backwards compatibility with tests */
  selectAssessment(assessment: ReviewAssessment): void {
    const rating: ReviewRating =
      assessment === 'FORGOT'
        ? 'AGAIN'
        : assessment === 'STRUGGLED'
        ? 'HARD'
        : 'GOOD';
    this.selectRating(rating);
  }

  retryMutation(): void {
    const lastRating = this.lastAttemptedRating();
    if (lastRating) {
      this.selectRating(lastRating);
    }
  }

  checkDueFutureCards(): void {
    if (this.currentCard() === null) {
      this.selectNextCard();
    }
  }

  private scheduleNextDueCheck(): void {
    this.clearScheduledTimer();

    const pool = this.learningPool();
    if (pool.length === 0) return;

    const now = Date.now();
    const earliestDueTime = Math.min(...pool.map((c) => c.dueTime));
    const targetTime = earliestDueTime - LEARN_AHEAD_WINDOW_MS;
    const delay = Math.max(1000, targetTime - now);

    if (delay <= 25 * 60 * 1000) {
      this.scheduledTimerId = setTimeout(() => {
        this.scheduledTimerId = null;
        this.checkDueFutureCards();
      }, delay);
    }
  }

  private clearScheduledTimer(): void {
    if (this.scheduledTimerId !== null) {
      clearTimeout(this.scheduledTimerId);
      this.scheduledTimerId = null;
    }
  }

  private resetCardState(card: ReviewSessionItem | null = this.currentCard()): void {
    this.presentationSequence++;
    const presentationId = this.presentationSequence;
    this.revealed.set(false);
    this.lookupError.set(null);
    this.mutationError.set(null);
    this.audioError.set(null);
    this.stopAudio();

    if (!card) return;

    const cached =
      card.dictionaryWord ??
      this.lexicalDataCache.get(card.entry.wordId) ??
      this.lexicalDataCache.get(card.entry.word.toLowerCase()) ??
      null;

    if (cached) {
      this.dictionaryWord.set(cached);
      this.lookupLoading.set(false);
      this.autoplayWordAudio(presentationId);
    } else {
      this.dictionaryWord.set(null);
      this.lookupLoading.set(false);
      this.loadDictionaryForCurrentCard(presentationId, card.entry.wordId);
    }
  }

  resetToSelector(): void {
    this.sessionStarted.set(false);
    this.completed.set(false);
    this.baseQueue.set([]);
    this.pendingQueue.set([]);
    this.currentCard.set(null);
    this.allInitialCards.set([]);
    this.sessionResults.set([]);
    this.reviewedDistinctWordIds.set(new Set());
    this.currentIndex.set(0);
    this.revealed.set(false);
    this.dictionaryWord.set(null);
    this.stopAudio();
    this.clearScheduledTimer();
    this.hasReconciledForEmpty = false;
  }

  getStatusLabel(status: VocabularyStatus): string {
    switch (status) {
      case 'NEW':
        return 'Nueva';
      case 'LEARNING':
        return 'Aprendiendo';
      case 'KNOWN':
        return 'Conocida';
      case 'IGNORED':
        return 'Ignorada';
    }
  }

  getStatusBadgeClass(status: VocabularyStatus): string {
    switch (status) {
      case 'NEW':
        return 'badge-new';
      case 'LEARNING':
        return 'badge-learning';
      case 'KNOWN':
        return 'badge-known';
      case 'IGNORED':
        return 'badge-ignored';
    }
  }

  backToVocabulary(): void {
    this.vocabularyService.invalidatePreparationCache();
    void this.router.navigate(['/vocabulary']);
  }
}
