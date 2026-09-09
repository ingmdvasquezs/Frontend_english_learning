import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderData, ReaderToken } from '../../models/reader.models';
import { ReaderService } from '../../services/reader';
import { ReaderTokenStream, ReaderWordSelection } from '../../components/reader-token-stream/reader-token-stream';
import { ReaderWordPopover } from '../../components/reader-word-popover/reader-word-popover';
import { ReaderWordInteraction } from '../../services/reader-word-interaction';

@Component({
  selector: 'app-reader',
  imports: [RouterLink, ReaderTokenStream, ReaderWordPopover],
  providers: [ReaderWordInteraction],
  templateUrl: './reader.html',
  styleUrl: './reader.css',
})
export class Reader implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly readerService = inject(ReaderService);
  private readonly wordInteraction = inject(ReaderWordInteraction);

  readonly readerData = signal<ReaderData | null>(null);
  readonly selectedToken = this.wordInteraction.selectedToken;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingStatus = this.wordInteraction.savingStatus;
  readonly completingReading = signal(false);
  readonly completionError = signal<string | null>(null);
  readonly statusError = this.wordInteraction.statusError;
  readonly dictionaryWord = this.wordInteraction.dictionaryWord;
  readonly lookupLoading = this.wordInteraction.lookupLoading;
  readonly lookupUnavailable = this.wordInteraction.lookupUnavailable;
  readonly audioError = this.wordInteraction.audioError;
  readonly definitionsOpen = this.wordInteraction.definitionsOpen;
  readonly popoverPosition = this.wordInteraction.popoverPosition;
  readonly vocabularyStatuses = this.wordInteraction.statuses;
  readonly selectedExplicitStatus = this.wordInteraction.selectedStatus;

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

  toggleDefinitions(event: MouseEvent): void {
    this.wordInteraction.toggleDefinitions(event);
  }

  playAudio(audioUrl: string | null): void {
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

}
