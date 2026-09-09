import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, defer, finalize } from 'rxjs';
import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import { DictionaryService, DictionaryWord } from '../../../shared/services/dictionary';
import { ReaderToken } from '../models/reader.models';
import { ReaderPopoverPosition } from '../components/reader-word-popover/reader-word-popover';
import { ReaderService } from './reader';

@Injectable()
export class ReaderWordInteraction {
  private readonly reader = inject(ReaderService);
  private readonly dictionary = inject(DictionaryService);
  private readonly destroyRef = inject(DestroyRef);
  private lookupRequestId = 0;
  private statusSubscription: Subscription | null = null;

  readonly selectedToken = signal<ReaderToken | null>(null);
  readonly dictionaryWord = signal<DictionaryWord | null>(null);
  readonly lookupLoading = signal(false);
  readonly lookupUnavailable = signal(false);
  readonly savingStatus = signal(false);
  readonly statusError = signal<string | null>(null);
  readonly audioError = signal<string | null>(null);
  readonly definitionsOpen = signal(false);
  readonly popoverPosition = signal<ReaderPopoverPosition | null>(null);
  readonly statuses: readonly VocabularyStatus[] = ['NEW', 'LEARNING', 'KNOWN', 'IGNORED'];
  readonly selectedStatus = computed(() => this.selectedToken()?.status ?? null);

  selectWord(token: ReaderToken, event: MouseEvent): void {
    if (this.savingStatus()) return;
    event.stopPropagation();
    this.positionFrom((event.currentTarget as HTMLElement).getBoundingClientRect(), 340);
    this.selectedToken.set(token);
    this.dictionaryWord.set(null);
    this.lookupUnavailable.set(false);
    this.statusError.set(null);
    this.audioError.set(null);
    this.definitionsOpen.set(false);
    this.lookup(token.value);
  }

  saveStatus(
    status: VocabularyStatus,
    language: string,
    updateTokens: (selected: ReaderToken, status: VocabularyStatus) => void
  ): void {
    const selected = this.selectedToken();
    if (!selected || this.savingStatus()) return;
    this.savingStatus.set(true);
    this.statusError.set(null);
    this.statusSubscription = defer(() =>
      this.reader.setVocabularyStatus(selected.value, language, status)
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.savingStatus.set(false);
        this.statusSubscription = null;
      })
    ).subscribe({
      next: () => {
        updateTokens(selected, status);
        this.selectedToken.set({ ...selected, status });
        this.savingStatus.set(false);
      },
      error: () => this.statusError.set('No pudimos actualizar esta palabra. Intenta nuevamente.'),
    });
  }

  close(): void {
    if (!this.savingStatus()) this.clearSelection();
  }

  reset(): void {
    this.statusSubscription?.unsubscribe();
    this.statusSubscription = null;
    this.savingStatus.set(false);
    this.clearSelection();
  }

  toggleDefinitions(event: MouseEvent): void {
    event.stopPropagation();
    const willOpen = !this.definitionsOpen();
    this.definitionsOpen.set(willOpen);
    const position = this.popoverPosition();
    if (position) this.reposition(position, willOpen ? 560 : 340);
  }

  playAudio(audioUrl: string | null): void {
    if (!audioUrl) return;
    this.audioError.set(null);
    new Audio(audioUrl).play().catch(() => this.audioError.set('Audio temporalmente no disponible'));
  }

  private lookup(word: string): void {
    const requestId = ++this.lookupRequestId;
    this.lookupLoading.set(true);
    defer(() => this.dictionary.lookupWord(word)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (requestId !== this.lookupRequestId) return;
        try {
          const result = this.dictionary.parseLookupWordResponse(response);
          result.word ? this.dictionaryWord.set(result) : this.lookupUnavailable.set(true);
        } catch {
          this.lookupUnavailable.set(true);
        } finally {
          this.lookupLoading.set(false);
        }
      },
      error: () => {
        if (requestId !== this.lookupRequestId) return;
        this.lookupLoading.set(false);
        this.lookupUnavailable.set(true);
      },
    });
  }

  private clearSelection(): void {
    this.lookupRequestId += 1;
    this.selectedToken.set(null);
    this.dictionaryWord.set(null);
    this.lookupLoading.set(false);
    this.lookupUnavailable.set(false);
    this.statusError.set(null);
    this.audioError.set(null);
    this.definitionsOpen.set(false);
    this.popoverPosition.set(null);
  }

  private positionFrom(rect: DOMRect, requiredHeight: number): void {
    const width = 340;
    const padding = 16;
    const x = Math.max(width / 2 + padding, Math.min(rect.left + rect.width / 2, window.innerWidth - width / 2 - padding));
    const below = window.innerHeight - rect.bottom;
    const openAbove = below < requiredHeight && rect.top > below;
    this.popoverPosition.set({ x, y: openAbove ? rect.top - 10 : rect.bottom + 10, openAbove, anchorTop: rect.top, anchorBottom: rect.bottom });
  }

  private reposition(position: ReaderPopoverPosition, requiredHeight: number): void {
    const below = window.innerHeight - position.anchorBottom;
    const openAbove = below < requiredHeight && position.anchorTop > below;
    this.popoverPosition.set({ ...position, openAbove, y: openAbove ? position.anchorTop - 10 : position.anchorBottom + 10 });
  }
}
