import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, switchMap } from 'rxjs';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderToken } from '../../../reader/models/reader.models';
import { ReaderTokenStream, ReaderWordSelection } from '../../../reader/components/reader-token-stream/reader-token-stream';
import { ReaderWordPopover } from '../../../reader/components/reader-word-popover/reader-word-popover';
import { ReaderWordInteraction } from '../../../reader/services/reader-word-interaction';
import { DocumentProgress, DocumentSection, DocumentStructure, DocumentUnit, DocumentVocabularyCompatibility, ImportedDocument } from '../../models/document.models';
import { DocumentService } from '../../services/document';
import { ReaderNarrationControls } from '../../../../shared/components/reader-narration-controls/reader-narration-controls';
import { NarrationService } from '../../../../shared/narration/narration.service';
import { createNarrationTokenMap, findNarrationWordTokenIndex } from '../../../../shared/narration/narration-token-map';

@Component({ selector: 'app-document-reader', imports: [RouterLink, ReaderTokenStream, ReaderWordPopover, ReaderNarrationControls], providers:[ReaderWordInteraction], templateUrl: './document-reader.html', styleUrls: ['../../../reader/pages/reader/reader.css', './document-reader.css'] })
export class DocumentReader implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly documents = inject(DocumentService);
  private readonly wordInteraction = inject(ReaderWordInteraction);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browserDocument = inject(DOCUMENT);
  private readonly narration = inject(NarrationService);
  private readonly readerTop = viewChild<ElementRef<HTMLElement>>('readerTop');
  private readonly tocTrigger = viewChild<ElementRef<HTMLButtonElement>>('tocTrigger');
  private readonly tocItems = viewChildren<ElementRef<HTMLButtonElement>>('tocItem');
  private scrollFrame: number | null = null;
  private tocScrollFrame: number | null = null;
  private previousBodyOverflow = '';
  private bodyScrollLocked = false;
  private compatibilityLoaded = false;
  private compatibilityStale = false;

  readonly document = signal<ImportedDocument | null>(null);
  readonly structure = signal<DocumentStructure | null>(null);
  readonly unit = signal<DocumentUnit | null>(null);
  readonly progress = signal<DocumentProgress | null>(null);
  readonly loading = signal(true);
  readonly loadingUnit = signal(false);
  readonly savingProgress = signal(false);
  readonly error = signal<string | null>(null);
  readonly progressError = signal<string | null>(null);
  readonly tocOpen = signal(false);
  readonly compatibility = signal<DocumentVocabularyCompatibility | null>(null);
  readonly compatibilityLoading = signal(false);
  readonly compatibilityError = signal<string | null>(null);
  readonly navigableSections = computed(() =>
    (this.structure()?.sections ?? []).filter((section) => section.firstUnitId !== null && section.unitCount > 0)
  );
  readonly showToc = computed(() => this.navigableSections().length > 1);
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
  readonly narrationContent = computed(() => createNarrationTokenMap(this.unit()?.tokens ?? []));
  readonly activeNarrationTokenIndex = computed(() =>
    findNarrationWordTokenIndex(this.narrationContent().ranges,this.narration.currentCharacterIndex())
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
      if (this.tocScrollFrame !== null) cancelAnimationFrame(this.tocScrollFrame);
      this.unlockBodyScroll();
      this.narration.stop();
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
        return this.documents.getStructure(documentId).pipe(map((structure) => {
          this.structure.set(structure);
          const unitId = progress.currentUnitId ?? structure.firstUnitId;
          if (!unitId) throw new Error('NO_CONTENT');
          return { unitId, progress };
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
    this.narration.stop();
    this.wordInteraction.reset();
    this.loadingUnit.set(true);
    this.progressError.set(null);
    this.documents.getUnit(documentId, unitId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (unit) => { this.unit.set(unit); this.loadingUnit.set(false); this.saveProgress(unit.unitId, false); this.scrollReaderToTopAfterRender(); },
      error: () => { this.progressError.set('No pudimos abrir esta parte del libro.'); this.loadingUnit.set(false); },
    });
  }

  toggleToc(): void {
    this.tocOpen() ? this.closeToc() : this.openToc();
  }

  openToc(): void {
    if (!this.showToc()) return;
    this.previousBodyOverflow = this.browserDocument.body.style.overflow;
    this.browserDocument.body.style.overflow = 'hidden';
    this.bodyScrollLocked = true;
    this.tocOpen.set(true);
    this.scrollCurrentTocItemAfterRender();
    this.loadCompatibilityIfNeeded();
  }

  closeToc(restoreFocus = true): void {
    if (!this.tocOpen()) return;
    this.tocOpen.set(false);
    if (this.tocScrollFrame !== null) {
      cancelAnimationFrame(this.tocScrollFrame);
      this.tocScrollFrame = null;
    }
    this.unlockBodyScroll();
    if (restoreFocus) this.tocTrigger()?.nativeElement.focus();
  }

  navigateToSection(section: DocumentSection): void {
    if (!section.firstUnitId || section.unitCount === 0 || this.loadingUnit() || this.savingProgress()) return;
    this.closeToc(false);
    this.navigateTo(section.firstUnitId);
  }

  sectionLabel(section: DocumentSection): string {
    if (section.title?.trim()) return section.title.trim();
    return this.document()?.format === 'PDF' ? `Página ${section.ordinal}` : `Sección ${section.ordinal}`;
  }

  sectionPartsLabel(section: DocumentSection): string {
    return `${section.unitCount} ${section.unitCount === 1 ? 'parte' : 'partes'}`;
  }

  currentSectionLabel(current: DocumentUnit): string {
    if (current.sectionTitle?.trim()) return current.sectionTitle.trim();
    return this.document()?.format === 'PDF' ? `Página ${current.sectionOrdinal}` : `Sección ${current.sectionOrdinal}`;
  }

  isCurrentSection(section: DocumentSection): boolean {
    return this.unit()?.sectionId === section.id;
  }

  @HostListener('document:keydown.escape')
  closeTocOnEscape(): void {
    if (this.tocOpen()) {
      this.closeToc();
    } else {
      this.closeSelector();
    }
  }

  finish(): void {
    const unit = this.unit();
    if (unit) this.saveProgress(unit.unitId, true);
  }

  selectWord(token: ReaderToken, event: MouseEvent): void {
    this.narration.stop();
    this.wordInteraction.selectWord(token, event);
  }

  selectWordFromStream(selection: ReaderWordSelection): void { this.selectWord(selection.token, selection.event); }

  closeSelector(): void { this.wordInteraction.close(); }

  @HostListener('window:scroll')
  closeOnScroll(): void { this.closeSelector(); }

  toggleDefinitions(event: MouseEvent): void { this.wordInteraction.toggleDefinitions(event); }

  playAudio(audioUrl: string): void { this.narration.stop(); this.wordInteraction.playAudio(audioUrl); }

  saveStatus(status: VocabularyStatus): void {
    const unit = this.unit();
    const language = this.document()?.language;
    if (!unit || !language) return;
    this.wordInteraction.saveStatus(status, language, (token, nextStatus) => {
      const normalized = token.normalizedValue;
      this.unit.update((current) => current ? { ...current, tokens: current.tokens.map((candidate) => candidate.type === 'WORD' && (normalized !== null ? candidate.normalizedValue === normalized : candidate === token) ? { ...candidate, status:nextStatus } : candidate) } : current);
      this.invalidateCompatibility();
    });
  }

  loadCompatibilityIfNeeded(): void {
    const documentId = this.document()?.documentId;
    if (!documentId || this.compatibilityLoading()) return;
    if (this.compatibilityLoaded && !this.compatibilityStale) return;

    this.compatibilityLoading.set(true);
    this.compatibilityError.set(null);
    this.documents
      .getCompatibility(documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (compatibility) => {
          this.compatibility.set(compatibility);
          this.compatibilityLoading.set(false);
          this.compatibilityLoaded = true;
          this.compatibilityStale = false;
        },
        error: () => {
          this.compatibilityError.set('No se pudo cargar el resumen de vocabulario.');
          this.compatibilityLoading.set(false);
        },
      });
  }

  private invalidateCompatibility(): void {
    this.compatibilityStale = true;
    if (this.tocOpen()) {
      this.loadCompatibilityIfNeeded();
    }
  }

  formatNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  formatConfidence(value: number): string {
    return Number.isFinite(value) ? `${Math.round(value)}%` : '0%';
  }

  scrollReaderToTopAfterRender(): void {
    if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.readerTop()?.nativeElement.scrollIntoView({ behavior:'auto', block:'start' });
    });
  }

  scrollCurrentTocItemAfterRender(): void {
    if (this.tocScrollFrame !== null) cancelAnimationFrame(this.tocScrollFrame);
    this.tocScrollFrame = requestAnimationFrame(() => {
      this.tocScrollFrame = null;
      const sectionId = this.unit()?.sectionId;
      const currentItem = this.tocItems().find((item) => item.nativeElement.dataset['sectionId'] === sectionId);
      currentItem?.nativeElement.scrollIntoView({ behavior:'auto',block:'center' });
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

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked) return;
    this.browserDocument.body.style.overflow = this.previousBodyOverflow;
    this.bodyScrollLocked = false;
  }

  private fail(message: string): void { this.error.set(message); this.loading.set(false); }
}
