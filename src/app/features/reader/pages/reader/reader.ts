import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DictionaryService,
  DictionaryWord,
} from '../../../../shared/services/dictionary';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderData, ReaderToken } from '../../models/reader.models';
import { ReaderService } from '../../services/reader';

interface PopoverPosition {
  x: number;
  y: number;
  openAbove: boolean;
  anchorTop: number;
  anchorBottom: number;
}

@Component({
  selector: 'app-reader',
  imports: [RouterLink],
  templateUrl: './reader.html',
  styleUrl: './reader.css',
})
export class Reader implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly readerService = inject(ReaderService);
  private readonly dictionaryService = inject(DictionaryService);
  private lookupRequestId = 0;

  readonly readerData = signal<ReaderData | null>(null);
  readonly selectedToken = signal<ReaderToken | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingStatus = signal(false);
  readonly completingReading = signal(false);
  readonly completionError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly dictionaryWord = signal<DictionaryWord | null>(null);
  readonly lookupLoading = signal(false);
  readonly lookupUnavailable = signal(false);
  readonly audioError = signal<string | null>(null);
  readonly definitionsOpen = signal(false);
  readonly popoverPosition = signal<PopoverPosition | null>(null);
  readonly vocabularyStatuses: readonly VocabularyStatus[] = [
    'NEW',
    'LEARNING',
    'KNOWN',
    'IGNORED',
  ];

  readonly selectedExplicitStatus = computed(
    () => this.selectedToken()?.status ?? null
  );

  ngOnInit(): void {
    const readingId = this.route.snapshot.paramMap.get('readingId');
    if (!readingId) {
      this.loading.set(false);
      this.error.set('No pudimos cargar esta lectura.');
      return;
    }
    this.loadReader(readingId);
  }

  selectWord(token: ReaderToken, event: MouseEvent): void {
    if (this.savingStatus()) {
      return;
    }

    event.stopPropagation();
    this.setPopoverPosition(
      (event.currentTarget as HTMLElement).getBoundingClientRect(),
      340
    );
    this.selectedToken.set(token);
    this.statusError.set(null);
    this.dictionaryWord.set(null);
    this.lookupUnavailable.set(false);
    this.audioError.set(null);
    this.definitionsOpen.set(false);
    this.lookupWord(token.value);
  }

  closeSelector(): void {
    if (!this.savingStatus()) {
      this.lookupRequestId += 1;
      this.selectedToken.set(null);
      this.statusError.set(null);
      this.dictionaryWord.set(null);
      this.lookupLoading.set(false);
      this.lookupUnavailable.set(false);
      this.audioError.set(null);
      this.definitionsOpen.set(false);
      this.popoverPosition.set(null);
    }
  }

  @HostListener('window:scroll')
  closeOnScroll(): void {
    this.closeSelector();
  }

  toggleDefinitions(event: MouseEvent): void {
    event.stopPropagation();
    const willOpen = !this.definitionsOpen();
    this.definitionsOpen.set(willOpen);
    const position = this.popoverPosition();
    if (position) {
      this.recalculateVerticalPosition(position, willOpen ? 560 : 340);
    }
  }

  playAudio(audioUrl: string | null): void {
    if (!audioUrl) {
      return;
    }
    this.audioError.set(null);
    new Audio(audioUrl).play().catch(() => {
      this.audioError.set('Audio temporalmente no disponible');
    });
  }

  saveStatus(status: VocabularyStatus): void {
    const data = this.readerData();
    const selected = this.selectedToken();
    if (!data || !selected || this.savingStatus()) {
      return;
    }

    this.savingStatus.set(true);
    this.statusError.set(null);

    this.readerService
      .setVocabularyStatus(selected.value, data.language, status)
      .subscribe({
        next: () => {
          const normalizedValue = selected.normalizedValue;
          this.readerData.update((current) =>
            current
              ? {
                  ...current,
                  tokens: current.tokens.map((token) =>
                    token.type === 'WORD' &&
                    (normalizedValue !== null
                      ? token.normalizedValue === normalizedValue
                      : token === selected)
                      ? { ...token, status }
                      : token
                  ),
                }
              : current
          );
          this.selectedToken.set({ ...selected, status });
          this.savingStatus.set(false);
        },
        error: () => {
          this.statusError.set(
            'No pudimos actualizar esta palabra. Intenta nuevamente.'
          );
          this.savingStatus.set(false);
        },
      });
  }

  completeReading(): void {
    const data = this.readerData();
    if (!data || data.progressStatus === 'COMPLETED' || this.completingReading()) {
      return;
    }
    this.completingReading.set(true);
    this.completionError.set(null);
    this.readerService.completeReading(data.readingId).subscribe({
      next: (response) => {
        try {
          const result = this.readerService.parseCompleteReading(response);
          this.readerData.update((current) =>
            current ? { ...current, progressStatus: result.status } : current
          );
        } catch {
          this.completionError.set(
            'No pudimos marcar la lectura como terminada. Inténtalo de nuevo.'
          );
        }
        this.completingReading.set(false);
      },
      error: () => {
        this.completionError.set(
          'No pudimos marcar la lectura como terminada. Inténtalo de nuevo.'
        );
        this.completingReading.set(false);
      },
    });
  }

  private loadReader(readingId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.readerService.getReaderData(readingId).subscribe({
      next: (response) => {
        try {
          this.readerData.set(this.readerService.parseReaderData(response));
        } catch {
          this.error.set('No pudimos cargar esta lectura.');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar esta lectura.');
        this.loading.set(false);
      },
    });
  }

  private lookupWord(word: string): void {
    const requestId = ++this.lookupRequestId;
    this.lookupLoading.set(true);

    this.dictionaryService.lookupWord(word).subscribe({
      next: (response) => {
        if (requestId !== this.lookupRequestId) {
          return;
        }
        const dictionaryWord =
          this.dictionaryService.parseLookupWordResponse(response);
        if (!dictionaryWord.word) {
          this.lookupUnavailable.set(true);
        } else {
          this.dictionaryWord.set(dictionaryWord);
        }
        this.lookupLoading.set(false);
      },
      error: () => {
        if (requestId !== this.lookupRequestId) {
          return;
        }
        this.lookupLoading.set(false);
        this.lookupUnavailable.set(true);
      },
    });
  }

  private setPopoverPosition(rect: DOMRect, requiredHeight: number): void {
    const popoverWidth = 340;
    const viewportPadding = 16;
    const minX = popoverWidth / 2 + viewportPadding;
    const maxX = window.innerWidth - popoverWidth / 2 - viewportPadding;
    const x = Math.max(
      minX,
      Math.min(rect.left + rect.width / 2, maxX)
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < requiredHeight && spaceAbove > spaceBelow;

    this.popoverPosition.set({
      x,
      y: openAbove ? rect.top - 10 : rect.bottom + 10,
      openAbove,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    });
  }

  private recalculateVerticalPosition(
    position: PopoverPosition,
    requiredHeight: number
  ): void {
    const spaceBelow = window.innerHeight - position.anchorBottom;
    const spaceAbove = position.anchorTop;
    const openAbove = spaceBelow < requiredHeight && spaceAbove > spaceBelow;
    this.popoverPosition.set({
      ...position,
      openAbove,
      y: openAbove ? position.anchorTop - 10 : position.anchorBottom + 10,
    });
  }
}
