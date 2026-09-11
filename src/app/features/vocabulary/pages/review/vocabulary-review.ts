import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { DictionaryService, DictionaryWord } from '../../../../shared/services/dictionary';
import {
  PreparedReviewEntry,
  ReviewAssessment,
  ReviewBatchSize,
  ReviewResultItem,
} from '../../models/vocabulary.models';
import { VocabularyService } from '../../services/vocabulary.service';

export interface ReviewSessionItem {
  entry: PreparedReviewEntry;
  isReinforcement: boolean;
  baseWordNumber: number;
}

@Component({
  selector: 'app-vocabulary-review',
  imports: [RouterLink],
  templateUrl: './vocabulary-review.html',
  styleUrl: './vocabulary-review.css',
})
export class VocabularyReview {
  private readonly vocabularyService = inject(VocabularyService);
  private readonly dictionaryService = inject(DictionaryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private audioInstance: HTMLAudioElement | null = null;
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reinforcedWordIds = new Set<string>();

  // Pre-session configuration state
  readonly sessionStarted = signal(false);
  readonly selectedSize = signal<ReviewBatchSize>(10);
  readonly availableSizes: ReviewBatchSize[] = [10, 20, 30];

  // Session state
  readonly loadingSession = signal(false);
  readonly sessionLoadError = signal<string | null>(null);
  readonly sessionCards = signal<ReviewSessionItem[]>([]);
  readonly currentIndex = signal(0);
  readonly completed = signal(false);
  readonly baseTotalWords = signal(0);
  readonly dueCount = signal(0);
  readonly totalReviewableCount = signal(0);

  // Derived session properties
  readonly totalWords = computed(() => this.baseTotalWords());
  readonly currentCard = computed(() => this.sessionCards()[this.currentIndex()] ?? null);
  readonly currentWord = computed(() => this.currentCard()?.entry ?? null);
  readonly isCurrentReinforcement = computed(() => this.currentCard()?.isReinforcement ?? false);

  readonly progressPercentage = computed(() => {
    const total = this.baseTotalWords();
    if (total === 0) return 0;
    const currentBaseNumber = this.currentCard()?.baseWordNumber ?? 1;
    return Math.min(100, Math.round((currentBaseNumber / total) * 100));
  });

  readonly isEmptySession = computed(
    () =>
      this.sessionStarted() &&
      !this.loadingSession() &&
      !this.sessionLoadError() &&
      this.sessionCards().length === 0
  );

  // Current item reveal & lookup state
  readonly revealed = signal(false);
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly dictionaryWord = signal<DictionaryWord | null>(null);
  readonly audioError = signal<string | null>(null);

  // Mutation & reinforcement feedback state
  readonly mutationPending = signal(false);
  readonly mutationError = signal<string | null>(null);
  readonly lastAttemptedAssessment = signal<ReviewAssessment | null>(null);
  readonly forgotFeedbackActive = signal(false);

  // Results of the current in-memory session (only base words)
  readonly sessionResults = signal<ReviewResultItem[]>([]);
  readonly forgotCount = computed(
    () => this.sessionResults().filter((item) => item.assessment === 'FORGOT').length
  );
  readonly struggledCount = computed(
    () => this.sessionResults().filter((item) => item.assessment === 'STRUGGLED').length
  );
  readonly rememberedCount = computed(
    () => this.sessionResults().filter((item) => item.assessment === 'REMEMBERED').length
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearAutoAdvanceTimer();
      this.stopAudio();
    });
  }

  private clearAutoAdvanceTimer(): void {
    if (this.autoAdvanceTimer !== null) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  selectSize(size: ReviewBatchSize): void {
    this.selectedSize.set(size);
  }

  startSession(): void {
    this.clearAutoAdvanceTimer();
    this.sessionStarted.set(true);
    this.loadingSession.set(true);
    this.sessionLoadError.set(null);
    this.completed.set(false);
    this.sessionResults.set([]);
    this.currentIndex.set(0);
    this.revealed.set(false);
    this.dictionaryWord.set(null);
    this.lookupError.set(null);
    this.mutationError.set(null);
    this.audioError.set(null);
    this.forgotFeedbackActive.set(false);
    this.reinforcedWordIds.clear();
    this.stopAudio();

    this.vocabularyService
      .prepareVocabularyReview(this.selectedSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.dueCount.set(session.dueCount);
          this.totalReviewableCount.set(session.totalReviewableCount);

          const entries = session.entries ?? [];
          this.baseTotalWords.set(entries.length);

          const cards: ReviewSessionItem[] = entries.map((entry, index) => ({
            entry,
            isReinforcement: false,
            baseWordNumber: index + 1,
          }));

          this.sessionCards.set(cards);
          this.loadingSession.set(false);
        },
        error: () => {
          this.sessionLoadError.set(
            'No pudimos cargar la sesión de repaso. Intenta nuevamente.'
          );
          this.loadingSession.set(false);
        },
      });
  }

  revealMeaning(): void {
    const word = this.currentWord();
    if (!word || this.revealed()) return;

    this.revealed.set(true);
    this.lookupLoading.set(true);
    this.lookupError.set(null);

    this.dictionaryService
      .lookupWord(word.word)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (responseXml) => {
          try {
            const parsed = this.dictionaryService.parseLookupWordResponse(responseXml);
            const hasContent =
              (parsed.translation && parsed.translation.trim().length > 0) ||
              (parsed.meanings && parsed.meanings.length > 0) ||
              Boolean(parsed.audioUrl) ||
              Boolean(parsed.phonetic);

            if (hasContent) {
              this.dictionaryWord.set(parsed);
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
          this.lookupError.set('No pudimos cargar el significado.');
          this.lookupLoading.set(false);
        },
      });
  }

  retryLookup(): void {
    this.revealed.set(false);
    this.revealMeaning();
  }

  playAudio(): void {
    const audioUrl = this.dictionaryWord()?.audioUrl;
    if (!audioUrl) return;

    this.stopAudio();
    this.audioError.set(null);

    try {
      this.audioInstance = new Audio(audioUrl);
      const playPromise = this.audioInstance.play();
      if (playPromise) {
        playPromise.catch(() => {
          this.audioError.set('Audio no disponible');
        });
      }
    } catch {
      this.audioError.set('Audio no disponible');
    }
  }

  private stopAudio(): void {
    if (this.audioInstance) {
      this.audioInstance.pause();
      this.audioInstance = null;
    }
  }

  selectAssessment(assessment: ReviewAssessment): void {
    const card = this.currentCard();
    const word = card?.entry;
    if (!card || !word || this.mutationPending() || card.isReinforcement) return;

    this.lastAttemptedAssessment.set(assessment);
    this.mutationPending.set(true);
    this.mutationError.set(null);

    this.vocabularyService
      .recordVocabularyReview(word.wordId, assessment)
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
              assessment,
            },
          ]);

          this.mutationPending.set(false);
          this.lastAttemptedAssessment.set(null);

          if (assessment === 'FORGOT') {
            if (!this.reinforcedWordIds.has(word.wordId)) {
              this.reinforcedWordIds.add(word.wordId);
              this.insertReinforcement(word, card.baseWordNumber);
            }
            this.forgotFeedbackActive.set(true);
            this.clearAutoAdvanceTimer();
            this.autoAdvanceTimer = setTimeout(() => {
              this.advanceCard();
            }, 1000);
          } else {
            this.advanceCard();
          }
        },
        error: () => {
          this.mutationPending.set(false);
          this.mutationError.set('No pudimos guardar tu respuesta.');
        },
      });
  }

  private insertReinforcement(entry: PreparedReviewEntry, baseWordNumber: number): void {
    const cards = [...this.sessionCards()];
    const curr = this.currentIndex();
    let baseCount = 0;
    let insertIndex = cards.length;

    for (let i = curr + 1; i < cards.length; i++) {
      if (!cards[i].isReinforcement) {
        baseCount++;
        if (baseCount === 4) {
          insertIndex = i + 1;
          break;
        }
      }
    }

    const reinforcementItem: ReviewSessionItem = {
      entry,
      isReinforcement: true,
      baseWordNumber,
    };

    cards.splice(insertIndex, 0, reinforcementItem);
    this.sessionCards.set(cards);
  }

  handleReinforcementAction(_understood: boolean): void {
    // Local feedback only - NO backend mutation
    this.advanceCard();
  }

  retryMutation(): void {
    const lastAssessment = this.lastAttemptedAssessment();
    if (lastAssessment) {
      this.selectAssessment(lastAssessment);
    }
  }

  private advanceCard(): void {
    this.clearAutoAdvanceTimer();
    this.stopAudio();
    if (this.currentIndex() + 1 >= this.sessionCards().length) {
      this.completed.set(true);
    } else {
      this.currentIndex.update((i) => i + 1);
      this.revealed.set(false);
      this.dictionaryWord.set(null);
      this.lookupLoading.set(false);
      this.lookupError.set(null);
      this.mutationError.set(null);
      this.audioError.set(null);
      this.forgotFeedbackActive.set(false);
    }
  }

  resetToSelector(): void {
    this.clearAutoAdvanceTimer();
    this.sessionStarted.set(false);
    this.completed.set(false);
    this.sessionCards.set([]);
    this.sessionResults.set([]);
    this.currentIndex.set(0);
    this.revealed.set(false);
    this.dictionaryWord.set(null);
    this.stopAudio();
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
    this.clearAutoAdvanceTimer();
    void this.router.navigate(['/vocabulary']);
  }
}
