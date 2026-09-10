import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NORMAL_APPLICATION_PATH } from '../../../../app.paths';

import {
  InitialVocabularyTest,
  MINIMUM_ONBOARDING_CLASSIFICATIONS,
  VocabularyStatus,
} from '../../models/onboarding.models';
import { OnboardingService } from '../../services/onboarding';
import { Auth } from '../../../auth/services/auth';
import { ThemeService } from '../../../../shared/services/theme';
import {
  getParagraphs,
  getTextParts,
  normalizeWord,
} from '../../utils/reading-text';
import { ReaderWordPopover } from '../../../reader/components/reader-word-popover/reader-word-popover';
import { ReaderToken } from '../../../reader/models/reader.models';
import { ReaderWordInteraction } from '../../../reader/services/reader-word-interaction';

@Component({
  selector: 'app-onboarding',
  imports: [ReaderWordPopover],
  providers: [ReaderWordInteraction],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
})
export class Onboarding {
  private readonly onboardingService = inject(OnboardingService);
  private readonly wordInteraction = inject(ReaderWordInteraction);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly loading = signal(false);

  readonly error = signal<string | null>(null);

  readonly test = signal<InitialVocabularyTest | null>(null);

  readonly wordStatuses =
    signal<Map<string, VocabularyStatus>>(new Map());

  readonly selectedToken = this.wordInteraction.selectedToken;
  readonly dictionaryWord = this.wordInteraction.dictionaryWord;
  readonly lookupLoading = this.wordInteraction.lookupLoading;
  readonly lookupUnavailable = this.wordInteraction.lookupUnavailable;
  readonly savingStatus = this.wordInteraction.savingStatus;
  readonly statusError = this.wordInteraction.statusError;
  readonly audioError = this.wordInteraction.audioError;
  readonly definitionsOpen = this.wordInteraction.definitionsOpen;
  readonly popoverPosition = this.wordInteraction.popoverPosition;
  readonly vocabularyStatuses = this.wordInteraction.statuses;
  readonly selectedExplicitStatus = this.wordInteraction.selectedStatus;

  readonly explicitClassifications = computed(() =>
    Array.from(this.wordStatuses(), ([word, status]) => ({ word, status }))
  );

  readonly classifiedWordCount = computed(
    () => this.explicitClassifications().length
  );

  readonly minimumClassifications = MINIMUM_ONBOARDING_CLASSIFICATIONS;

  readonly canFinishTest = computed(
    () => this.classifiedWordCount() >= MINIMUM_ONBOARDING_CLASSIFICATIONS
  );

  readonly remainingClassifications = computed(() =>
    Math.max(
      0,
      MINIMUM_ONBOARDING_CLASSIFICATIONS - this.classifiedWordCount()
    )
  );

  openWord(word: string, event: MouseEvent): void {
    const normalizedWord = normalizeWord(word);
    if (!normalizedWord) return;

    const token: ReaderToken = {
      value: word,
      normalizedValue: normalizedWord,
      type: 'WORD',
      status: this.wordStatuses().get(normalizedWord) ?? null,
    };
    this.wordInteraction.selectWord(token, event);
  }

  closeWordPopover(): void {
    this.wordInteraction.close();
  }

  @HostListener('document:keydown.escape')
  closeWordPopoverOnEscape(): void {
    this.closeWordPopover();
  }

  toggleWordDetails(event: MouseEvent): void {
    this.wordInteraction.toggleDefinitions(event);
  }

  selectWordStatus(status: VocabularyStatus): void {
    this.wordInteraction.setLocalStatus(status, (selected, nextStatus) => {
      this.setWordStatus(
        selected.normalizedValue ?? selected.value,
        nextStatus
      );
    });
  }

  playAudio(audioUrl: string | null): void {
    this.wordInteraction.playAudio(audioUrl);
  }

  loadTest(): void {
    this.loading.set(true);
    this.error.set(null);

    this.onboardingService
      .getInitialVocabularyTest()
      .subscribe({
        next: (response) => {
          const test =
            this.onboardingService
              .parseInitialVocabularyTest(response);

          this.wordInteraction.reset();
          this.wordStatuses.set(new Map());
          this.test.set(test);

          this.loading.set(false);
        },

        error: () => {
          this.error.set(
            'No se pudo cargar el test inicial'
          );

          this.loading.set(false);
        },
      });
  }

  getTextParts(text: string): string[] {
    return getTextParts(text);
  }

  getParagraphs(text: string): string[] {
    return getParagraphs(text);
  }

  normalizeWord(part: string): string {
    return normalizeWord(part);
  }

  isSelectable(part: string): boolean {
    const currentTest = this.test();

    if (!currentTest) {
      return false;
    }

    return currentTest.selectableWords.includes(
      normalizeWord(part)
    );
  }

  setWordStatus(
    word: string,
    status: VocabularyStatus
  ): void {
    const statuses =
      new Map(this.wordStatuses());

    const normalizedWord =
      normalizeWord(word);

    statuses.set(
      normalizedWord,
      status
    );

    this.wordStatuses.set(statuses);
  }

  getWordStatus(
    word: string
  ): VocabularyStatus {
    const normalizedWord =
      normalizeWord(word);

    return (
      this.wordStatuses().get(normalizedWord)
      ?? 'NEW'
    );
  }

  isKnown(word: string): boolean {
    return (
      this.getWordStatus(word) === 'KNOWN'
    );
  }

  isLearning(word: string): boolean {
    return (
      this.getWordStatus(word) === 'LEARNING'
    );
  }

  isIgnored(word: string): boolean {
    return (
      this.getWordStatus(word) === 'IGNORED'
    );
  }

  finishTest(): void {
    const currentTest = this.test();

    if (!currentTest || !this.canFinishTest() || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.onboardingService
      .completeInitialVocabularyTest(
        currentTest.testId,
        this.explicitClassifications()
      )
      .subscribe({
        next: () => {
          this.auth.markOnboardingCompleted();
          this.loading.set(false);
          void this.router.navigateByUrl(NORMAL_APPLICATION_PATH);
        },

        error: (response: unknown) => {
          this.error.set(
            this.isMinimumClassificationsFault(response)
              ? `Clasifica al menos ${MINIMUM_ONBOARDING_CLASSIFICATIONS} palabras antes de continuar.`
              : 'No se pudo completar el vocabulario inicial'
          );

          this.loading.set(false);
        },
      });
  }

  private isMinimumClassificationsFault(response: unknown): boolean {
    const rawMessage =
      response instanceof HttpErrorResponse
        ? typeof response.error === 'string'
          ? response.error
          : response.message
        : response instanceof Error
          ? response.message
          : '';

    return rawMessage
      .toLowerCase()
      .includes('unique vocabulary classifications are required');
  }

}
