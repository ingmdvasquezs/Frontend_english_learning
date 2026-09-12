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
  ReadingTextPart,
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

  private activeWordElement: HTMLElement | null = null;

  readonly loading = signal(false);

  readonly error = signal<string | null>(null);

  readonly test = signal<InitialVocabularyTest | null>(null);

  readonly currentSectionIndex = signal(0);

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

  readonly paragraphs = computed(() => {
    const currentTest = this.test();
    if (!currentTest) return [];
    return getParagraphs(currentTest.text);
  });

  readonly totalSections = computed(() => this.paragraphs().length || 4);

  readonly currentParagraph = computed(() => {
    const paras = this.paragraphs();
    return paras[this.currentSectionIndex()] ?? '';
  });

  readonly isFirstSection = computed(() => this.currentSectionIndex() === 0);

  readonly isLastSection = computed(
    () => this.currentSectionIndex() >= this.totalSections() - 1
  );

  readonly explicitClassifications = computed(() =>
    Array.from(this.wordStatuses(), ([word, status]) => ({ word, status }))
  );

  readonly classifiedWordCount = computed(
    () => this.explicitClassifications().length
  );

  readonly minimumClassifications = MINIMUM_ONBOARDING_CLASSIFICATIONS;

  readonly canFinishTest = computed(
    () =>
      this.isLastSection() &&
      this.classifiedWordCount() >= MINIMUM_ONBOARDING_CLASSIFICATIONS
  );

  readonly remainingClassifications = computed(() =>
    Math.max(
      0,
      MINIMUM_ONBOARDING_CLASSIFICATIONS - this.classifiedWordCount()
    )
  );

  nextSection(): void {
    if (!this.isLastSection()) {
      this.currentSectionIndex.update((i) => i + 1);
      this.closeWordPopover();
      this.saveSessionState();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  previousSection(): void {
    if (!this.isFirstSection()) {
      this.currentSectionIndex.update((i) => i - 1);
      this.closeWordPopover();
      this.saveSessionState();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  goToSection(index: number): void {
    if (index >= 0 && index < this.totalSections()) {
      this.currentSectionIndex.set(index);
      this.closeWordPopover();
      this.saveSessionState();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  openWord(word: string, event: MouseEvent): void {
    const normalizedWord = normalizeWord(word);
    if (!normalizedWord) return;

    this.activeWordElement = event.currentTarget as HTMLElement;

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

  onPageClick(): void {
    this.closeWordPopover();
  }

  @HostListener('document:keydown.escape')
  closeWordPopoverOnEscape(): void {
    this.closeWordPopover();
    this.activeWordElement?.focus();
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
    this.closeWordPopover();
    this.activeWordElement?.focus();
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
          this.currentSectionIndex.set(0);
          this.wordStatuses.set(new Map());
          this.test.set(test);
          this.restoreSessionState(test.testId);

          this.loading.set(false);
        },

        error: () => {
          this.error.set(
            'No se pudo cargar la prueba inicial'
          );

          this.loading.set(false);
        },
      });
  }

  getTextParts(text: string): ReadingTextPart[] {
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
    this.saveSessionState();
  }

  getWordStatus(
    word: string
  ): VocabularyStatus | null {
    const normalizedWord =
      normalizeWord(word);

    return this.wordStatuses().get(normalizedWord) ?? null;
  }

  getWordAriaLabel(part: string): string {
    const status = this.getWordStatus(part);
    if (!status) {
      return `${part}, sin clasificar`;
    }
    const labels: Record<VocabularyStatus, string> = {
      NEW: 'es nueva para mí',
      LEARNING: 'quiero aprenderla',
      KNOWN: 'ya la conozco',
      IGNORED: 'no me interesa',
    };
    return `${part}, ${labels[status]}`;
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
          this.clearSessionState();
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

  private getStorageKey(testId: string): string {
    return `onboarding_v2_${testId}`;
  }

  private saveSessionState(): void {
    const currentTest = this.test();
    if (!currentTest) return;
    try {
      const data = {
        sectionIndex: this.currentSectionIndex(),
        classifications: Array.from(this.wordStatuses().entries()),
      };
      sessionStorage.setItem(
        this.getStorageKey(currentTest.testId),
        JSON.stringify(data)
      );
    } catch {
      // Ignore storage errors
    }
  }

  private restoreSessionState(testId: string): void {
    try {
      const raw = sessionStorage.getItem(this.getStorageKey(testId));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.classifications)) {
        this.wordStatuses.set(new Map(data.classifications));
      }
      if (
        typeof data?.sectionIndex === 'number' &&
        data.sectionIndex >= 0 &&
        data.sectionIndex < this.totalSections()
      ) {
        this.currentSectionIndex.set(data.sectionIndex);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private clearSessionState(): void {
    const currentTest = this.test();
    if (!currentTest) return;
    try {
      sessionStorage.removeItem(this.getStorageKey(currentTest.testId));
    } catch {
      // Ignore storage errors
    }
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
