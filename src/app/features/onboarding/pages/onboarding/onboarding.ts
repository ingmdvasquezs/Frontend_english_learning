import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NORMAL_APPLICATION_PATH } from '../../../../app.paths';

import {
  DictionaryService,
  DictionaryWord,
} from '../../../../shared/services/dictionary';

import {
  InitialVocabularyTest,
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

interface PopoverPosition {
  x: number;
  y: number;
  openAbove: boolean;
  anchorTop: number;
  anchorBottom: number;
}

@Component({
  selector: 'app-onboarding',
  imports: [],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
})
export class Onboarding {
  private readonly dictionaryService = inject(DictionaryService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly selectedWord = signal<DictionaryWord | null>(null);

  readonly wordLoading = signal(false);
  readonly loading = signal(false);

  readonly error = signal<string | null>(null);
  readonly audioError = signal<string | null>(null);

  readonly test = signal<InitialVocabularyTest | null>(null);

  readonly wordStatuses =
    signal<Map<string, VocabularyStatus>>(new Map());

  readonly popoverPosition =
    signal<PopoverPosition | null>(null);

  readonly statusMenuOpen = signal(false);

  readonly wordDetailsOpen = signal(false);

  readonly explicitClassifications = computed(() =>
    Array.from(this.wordStatuses(), ([word, status]) => ({ word, status }))
  );

  readonly classifiedWordCount = computed(
    () => this.explicitClassifications().length
  );

  openWord(word: string, event: MouseEvent): void {
    event.stopPropagation();

    const normalizedWord = normalizeWord(word);

    if (!normalizedWord) {
      return;
    }

    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    const popoverWidth = 310;
    const estimatedPopoverHeight = 230;
    const viewportPadding = 16;
    const gap = 10;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // CENTRO DE LA PALABRA
    let x = rect.left + rect.width / 2;

    // EVITAR SALIR POR LA IZQUIERDA
    const minX =
      popoverWidth / 2 + viewportPadding;

    // EVITAR SALIR POR LA DERECHA
    const maxX =
      viewportWidth
      - popoverWidth / 2
      - viewportPadding;

    x = Math.max(
      minX,
      Math.min(x, maxX)
    );

    // ESPACIO DISPONIBLE
    const spaceBelow =
      viewportHeight - rect.bottom;

    const spaceAbove = rect.top;

    const openAbove =
      spaceBelow < estimatedPopoverHeight
      && spaceAbove > spaceBelow;

    const y = openAbove
      ? rect.top - gap
      : rect.bottom + gap;

    this.popoverPosition.set({
      x,
      y,
      openAbove,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    });

    this.statusMenuOpen.set(false);
    this.wordDetailsOpen.set(false);

    this.audioError.set(null);
    this.error.set(null);

    this.selectedWord.set(null);
    this.wordLoading.set(true);

    this.dictionaryService
      .lookupWord(normalizedWord)
      .subscribe({
        next: (response) => {
          const dictionaryWord =
            this.dictionaryService
              .parseLookupWordResponse(response);

          this.selectedWord.set(dictionaryWord);
          this.wordLoading.set(false);

          if (dictionaryWord.audioUrl) {
            this.playAudio(dictionaryWord.audioUrl);
          }
        },

        error: () => {
          this.error.set(
            `No se pudo obtener información de "${normalizedWord}"`
          );

          this.wordLoading.set(false);
        },
      });
  }

  closeWordPopover(): void {
    this.selectedWord.set(null);
    this.popoverPosition.set(null);

    this.statusMenuOpen.set(false);
    this.wordDetailsOpen.set(false);

    this.audioError.set(null);
  }

  toggleWordDetails(event: MouseEvent): void {
    event.stopPropagation();

    const willOpen = !this.wordDetailsOpen();
    this.wordDetailsOpen.set(willOpen);

    const position = this.popoverPosition();

    if (!position) {
      return;
    }

    const gap = 10;
    const viewportHeight = window.innerHeight;

    const compactPopoverHeight = 230;
    const expandedPopoverHeight = 520;

    const requiredHeight = willOpen
      ? expandedPopoverHeight
      : compactPopoverHeight;

    const spaceBelow =
      viewportHeight - position.anchorBottom;

    const spaceAbove =
      position.anchorTop;

    const openAbove =
      spaceBelow < requiredHeight
      && spaceAbove > spaceBelow;

    const y = openAbove
      ? position.anchorTop - gap
      : position.anchorBottom + gap;

    this.popoverPosition.set({
      ...position,
      y,
      openAbove,
    });
  }

  toggleStatusMenu(event: MouseEvent): void {
    event.stopPropagation();

    this.statusMenuOpen.update(
      (open) => !open
    );
  }

  selectWordStatus(
    word: string,
    status: VocabularyStatus
  ): void {
    this.setWordStatus(word, status);

    /*
     * Al seleccionar un estado cerramos únicamente
     * el menú lateral de estados.
     */
    this.statusMenuOpen.set(false);
  }

  playAudio(audioUrl: string | null): void {
    if (!audioUrl) {
      return;
    }

    this.audioError.set(null);

    const audio = new Audio(audioUrl);

    audio.play().catch(() => {
      this.audioError.set(
        'Audio temporalmente no disponible'
      );
    });
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

    if (!currentTest) {
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

        error: () => {
          this.error.set(
            'No se pudo completar el vocabulario inicial'
          );

          this.loading.set(false);
        },
      });
  }

}
