import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderToken } from '../../../reader/models/reader.models';
import { ReaderTokenStream, ReaderWordSelection } from '../../../reader/components/reader-token-stream/reader-token-stream';
import { ReaderWordPopover } from '../../../reader/components/reader-word-popover/reader-word-popover';
import { ReaderWordInteraction } from '../../../reader/services/reader-word-interaction';
import { DocumentProgress, DocumentUnit, ImportedDocument } from '../../models/document.models';
import { DocumentService } from '../../services/document';

@Component({ selector: 'app-document-reader', imports: [RouterLink, ReaderTokenStream, ReaderWordPopover], providers:[ReaderWordInteraction], templateUrl: './document-reader.html', styleUrls: ['../../../reader/pages/reader/reader.css', './document-reader.css'] })
export class DocumentReader implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly documents = inject(DocumentService);
  private readonly wordInteraction = inject(ReaderWordInteraction);
  private readonly destroyRef = inject(DestroyRef);
  private readonly readerTop = viewChild<ElementRef<HTMLElement>>('readerTop');
  private scrollFrame: number | null = null;

  readonly document = signal<ImportedDocument | null>(null);
  readonly unit = signal<DocumentUnit | null>(null);
  readonly progress = signal<DocumentProgress | null>(null);
  readonly loading = signal(true);
  readonly loadingUnit = signal(false);
  readonly savingProgress = signal(false);
  readonly error = signal<string | null>(null);
  readonly progressError = signal<string | null>(null);
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

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    });
  }

  ngOnInit(): void {
    const documentId = this.route.snapshot.paramMap.get('documentId');
    if (!documentId) return this.fail('No pudimos cargar este libro.');
    forkJoin({ document: this.documents.getDocument(documentId), progress: this.documents.getProgress(documentId) }).pipe(
      switchMap(({ document, progress }) => {
        this.document.set(document);
        this.progress.set(progress);
        if (document.status === 'PROCESSING') throw new Error('PROCESSING');
        if (document.status !== 'READY') throw new Error('FAILED');
        if (progress.currentUnitId) return of({ unitId: progress.currentUnitId, progress });
        return this.documents.getStructure(documentId).pipe(map((structure) => {
          if (!structure.firstUnitId) throw new Error('NO_CONTENT');
          return { unitId: structure.firstUnitId, progress };
        }));
      }),
      switchMap(({ unitId, progress }) => this.documents.getUnit(documentId, unitId).pipe(map((unit) => ({ unit, progress }))))
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ unit, progress }) => {
        this.unit.set(unit);
        this.loading.set(false);
        if (progress.status === 'NOT_STARTED') this.saveProgress(unit.unitId, false);
        this.scrollReaderToTopAfterRender();
      },
      error: (error: Error) => this.fail(error.message === 'NO_CONTENT' ? 'No pudimos encontrar contenido para comenzar este libro.' : error.message === 'PROCESSING' ? 'Este libro todavía se está preparando.' : 'No pudimos cargar este libro.'),
    });
  }

  navigateTo(unitId: string | null): void {
    const documentId = this.document()?.documentId;
    if (!documentId || !unitId || this.loadingUnit()) return;
    this.wordInteraction.reset();
    this.loadingUnit.set(true);
    this.progressError.set(null);
    this.documents.getUnit(documentId, unitId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (unit) => { this.unit.set(unit); this.loadingUnit.set(false); this.saveProgress(unit.unitId, false); this.scrollReaderToTopAfterRender(); },
      error: () => { this.progressError.set('No pudimos abrir esta parte del libro.'); this.loadingUnit.set(false); },
    });
  }

  finish(): void {
    const unit = this.unit();
    if (unit) this.saveProgress(unit.unitId, true);
  }

  selectWord(token: ReaderToken, event: MouseEvent): void {
    this.wordInteraction.selectWord(token, event);
  }

  selectWordFromStream(selection: ReaderWordSelection): void { this.selectWord(selection.token, selection.event); }

  closeSelector(): void { this.wordInteraction.close(); }

  @HostListener('window:scroll')
  closeOnScroll(): void { this.closeSelector(); }

  toggleDefinitions(event: MouseEvent): void { this.wordInteraction.toggleDefinitions(event); }

  playAudio(audioUrl: string): void { this.wordInteraction.playAudio(audioUrl); }

  saveStatus(status: VocabularyStatus): void {
    const unit = this.unit();
    const language = this.document()?.language;
    if (!unit || !language) return;
    this.wordInteraction.saveStatus(status, language, (token, nextStatus) => {
      const normalized = token.normalizedValue;
      this.unit.update((current) => current ? { ...current, tokens: current.tokens.map((candidate) => candidate.type === 'WORD' && (normalized !== null ? candidate.normalizedValue === normalized : candidate === token) ? { ...candidate, status:nextStatus } : candidate) } : current);
    });
  }

  scrollReaderToTopAfterRender(): void {
    if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.readerTop()?.nativeElement.scrollIntoView({ behavior:'auto', block:'start' });
    });
  }

  private saveProgress(currentUnitId: string, completed: boolean): void {
    const documentId = this.document()?.documentId; const progress = this.progress();
    if (!documentId || !progress || this.savingProgress() || (progress.currentUnitId === currentUnitId && progress.status === (completed ? 'COMPLETED' : 'IN_PROGRESS'))) return;
    this.savingProgress.set(true); this.progressError.set(null);
    this.documents.updateProgress(documentId, { currentUnitId, completed, expectedVersion: progress.version }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.progress.set(updated); this.savingProgress.set(false); },
      error: (response: HttpErrorResponse) => response.status === 409 ? this.reconcileProgress(documentId) : (this.progressError.set('No pudimos guardar tu progreso.'), this.savingProgress.set(false)),
    });
  }

  private reconcileProgress(documentId: string): void {
    this.documents.getProgress(documentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (progress) => { this.progress.set(progress); this.savingProgress.set(false); }, error: () => { this.progressError.set('No pudimos sincronizar tu progreso.'); this.savingProgress.set(false); } });
  }

  private fail(message: string): void { this.error.set(message); this.loading.set(false); }
}
