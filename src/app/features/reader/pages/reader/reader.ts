import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, concatMap } from 'rxjs';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderData, ReaderToken, UpdateReadingProgressRequest } from '../../models/reader.models';
import { ReaderService } from '../../services/reader';
import { ReaderTokenStream, ReaderWordSelection } from '../../components/reader-token-stream/reader-token-stream';
import { ReaderWordPopover } from '../../components/reader-word-popover/reader-word-popover';
import { ReaderWordInteraction } from '../../services/reader-word-interaction';
import { ReaderNarrationControls } from '../../../../shared/components/reader-narration-controls/reader-narration-controls';
import { NarrationService } from '../../../../shared/narration/narration.service';
import { createNarrationTokenMap, findNarrationWordTokenIndex } from '../../../../shared/narration/narration-token-map';
import { TEXT_PAGINATION_VERSION, createReadingParts } from '../../utils/reading-parts';

@Component({
  selector: 'app-reader',
  imports: [RouterLink, ReaderTokenStream, ReaderWordPopover, ReaderNarrationControls],
  providers: [ReaderWordInteraction],
  templateUrl: './reader.html',
  styleUrl: './reader.css',
})
export class Reader implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly readerService = inject(ReaderService);
  private readonly wordInteraction = inject(ReaderWordInteraction);
  private readonly narration = inject(NarrationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly readerTop = viewChild<ElementRef<HTMLElement>>('readerTop');
  private readonly progressUpdates = new Subject<UpdateReadingProgressRequest>();
  private scrollFrame: number | null = null;

  readonly readerData = signal<ReaderData | null>(null);
  readonly selectedToken = this.wordInteraction.selectedToken;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingStatus = this.wordInteraction.savingStatus;
  readonly completingReading = signal(false);
  readonly completionError = signal<string | null>(null);
  readonly progressError = signal<string | null>(null);
  readonly statusError = this.wordInteraction.statusError;
  readonly dictionaryWord = this.wordInteraction.dictionaryWord;
  readonly lookupLoading = this.wordInteraction.lookupLoading;
  readonly lookupUnavailable = this.wordInteraction.lookupUnavailable;
  readonly audioError = this.wordInteraction.audioError;
  readonly definitionsOpen = this.wordInteraction.definitionsOpen;
  readonly popoverPosition = this.wordInteraction.popoverPosition;
  readonly vocabularyStatuses = this.wordInteraction.statuses;
  readonly selectedExplicitStatus = this.wordInteraction.selectedStatus;
  readonly parts = computed(() => createReadingParts(this.readerData()?.tokens ?? []));
  readonly currentPartIndex = signal(0);
  readonly currentPart = computed(() => this.parts()[this.currentPartIndex()] ?? null);
  readonly narrationContent = computed(() => createNarrationTokenMap(this.currentPart()?.tokens ?? []));
  readonly activeNarrationTokenIndex = computed(() =>
    findNarrationWordTokenIndex(this.narrationContent().ranges,this.narration.currentCharacterIndex())
  );

  constructor() {
    this.progressUpdates
      .pipe(
        concatMap((request) =>
          this.readerService.updateReadingProgress(request).pipe(
            catchError(() => {
              this.progressError.set(
                'No pudimos guardar tu posición. Puedes seguir leyendo.'
              );
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    this.destroyRef.onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
      this.narration.stop();
    });
  }

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
    this.narration.stop();
    this.wordInteraction.selectWord(token, event);
  }

  selectWordFromStream(selection: ReaderWordSelection): void {
    this.selectWord(selection.token, selection.event);
  }

  closeSelector(): void {
    this.wordInteraction.close();
  }

  @HostListener('window:scroll')
  closeOnScroll(): void {
    this.closeSelector();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closeSelector();
  }

  toggleDefinitions(event: MouseEvent): void {
    this.wordInteraction.toggleDefinitions(event);
  }

  playAudio(audioUrl: string | null): void {
    this.narration.stop();
    this.wordInteraction.playAudio(audioUrl);
  }

  saveStatus(status: VocabularyStatus): void {
    const data = this.readerData();
    if (!data) return;
    this.wordInteraction.saveStatus(status, data.language, (selected, nextStatus) => {
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
                      ? { ...token, status: nextStatus }
                      : token
                  ),
                }
              : current
          );
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

  navigatePart(delta: -1 | 1): void {
    const nextIndex = this.currentPartIndex() + delta;
    if (nextIndex < 0 || nextIndex >= this.parts().length) return;
    this.narration.stop();
    this.wordInteraction.reset();
    this.currentPartIndex.set(nextIndex);
    this.scrollReaderToTopAfterRender();
    this.persistCurrentPart();
  }

  scrollReaderToTopAfterRender(): void {
    if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.readerTop()?.nativeElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }

  private loadReader(readingId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.readerService.getReaderData(readingId).subscribe({
      next: (response) => {
        try {
          const data = this.readerService.parseReaderData(response);
          this.readerData.set(data);
          this.currentPartIndex.set(
            this.resolveInitialPartIndex(data, this.parts().length)
          );
          if (data.progressStatus === null && this.currentPart()) {
            this.persistCurrentPart();
          }
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

  private resolveInitialPartIndex(data: ReaderData, totalParts: number): number {
    if (data.progressStatus === 'COMPLETED') return 0;
    const ordinal = data.currentPartOrdinal;
    if (
      data.paginationVersion === TEXT_PAGINATION_VERSION &&
      Number.isInteger(ordinal) &&
      ordinal !== null &&
      ordinal !== undefined &&
      ordinal >= 1 &&
      ordinal <= totalParts
    ) {
      return ordinal - 1;
    }
    return 0;
  }

  private persistCurrentPart(): void {
    const data = this.readerData();
    const part = this.currentPart();
    if (!data || !part) return;

    const request: UpdateReadingProgressRequest = {
      readingId: data.readingId,
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: part.ordinal,
      paginationVersion: TEXT_PAGINATION_VERSION,
    };
    this.progressError.set(null);
    this.readerData.update((current) =>
      current
        ? {
            ...current,
            progressStatus: request.progressStatus,
            currentPartOrdinal: request.currentPartOrdinal,
            paginationVersion: request.paginationVersion,
          }
        : current
    );
    this.progressUpdates.next(request);
  }

}
