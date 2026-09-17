import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, NgZone, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DeleteReadingResponse,
  PlatformReadingHistoryItem,
  PlatformReadingHistoryPage,
  UserReading,
  UserReadingsPage,
} from '../../models/library.models';
import { LibraryService, ReadingNotFoundSoapError } from '../../services/library';
import { toVocabularyCard } from '../../../../shared/utils/reading-metrics';
import { userTextCoverUrl } from '../../../../shared/utils/user-text-cover';
import { coverUrl } from '../../../home/utils/cover-url';
import { ImportedDocument } from '../../../documents/models/document.models';
import { DocumentService } from '../../../documents/services/document';
import { isDocumentNotFoundError, isDocumentProcessingError } from '../../../documents/utils/document-errors';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';
import { LibraryReadingCard } from '../../components/library-reading-card/library-reading-card';
import { LibraryCardItem } from '../../components/library-reading-card/library-reading-card.models';

export type LibraryFilter = 'all' | 'personal' | 'ebooks' | 'pdfs' | 'platform';
export type LibraryDeletionTarget =
  | { type: 'reading'; reading: UserReading }
  | { type: 'document'; document: ImportedDocument };

@Component({
  selector: 'app-library',
  imports: [RouterLink, LibraryReadingCard],
  providers: [DatePipe],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class Library implements OnInit, OnDestroy {
  private readonly libraryService = inject(LibraryService);
  private readonly documentService = inject(DocumentService);
  private readonly document = inject(DOCUMENT);
  private readonly ngZone = inject(NgZone);
  private readonly datePipe = inject(DatePipe);
  private readonly destroy$ = new Subject<void>();
  private actionMenuTrigger: HTMLElement | null = null;
  private actionMenuContainer: HTMLElement | null = null;
  private readonly outsidePointerDownHandler = (event: PointerEvent): void => {
    if (!this.openActionMenuKey()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.library-actions-wrap') || target?.closest('[data-library-actions]')) return;
    this.ngZone.run(() => this.closeActionMenu());
  };

  readonly readingsPage = signal<UserReadingsPage | null>(null);
  readonly readings = computed(() => this.readingsPage()?.readings ?? []);
  readonly readingCards = computed(() => this.readings().map(toVocabularyCard));
  readonly readingCount = computed(() => this.readingsPage()?.totalElements ?? 0);
  readonly documents = signal<ImportedDocument[]>([]);
  readonly documentCount = signal(0);
  readonly ebookCount = computed(() => this.documents().filter((document) => document.format === 'EPUB').length);
  readonly pdfCount = computed(() => this.documents().filter((document) => document.format === 'PDF').length);
  readonly documentsLoading = signal(true);
  readonly documentsError = signal<string | null>(null);
  readonly documentCoverUrls = signal<Readonly<Record<string, string>>>({});
  readonly failedDocumentCoverIds = signal<ReadonlySet<string>>(new Set());
  readonly openActionMenuKey = signal<string | null>(null);
  readonly deletionTarget = signal<LibraryDeletionTarget | null>(null);
  readonly deletingTargetKeys = signal<ReadonlySet<string>>(new Set());
  readonly deletingDocumentIds = computed(() => new Set(
    Array.from(this.deletingTargetKeys()).filter((key) => key.startsWith('document:')).map((key) => key.slice('document:'.length))
  ));
  readonly deleteError = signal<string | null>(null);
  readonly allCount = computed(() => this.readingCount() + this.documentCount());
  readonly activeFilter = signal<LibraryFilter>('all');

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly failedCoverIds = signal(new Set<string>());
  readonly textCoverUrl = userTextCoverUrl;

  readonly platformHistoryPage = signal<PlatformReadingHistoryPage | null>(null);
  readonly platformReadings = computed(() => this.platformHistoryPage()?.readings ?? []);
  readonly platformTotalElements = computed(() => this.platformHistoryPage()?.totalElements ?? 0);
  readonly platformPage = signal(0);
  readonly platformSize = signal(20);
  readonly platformTotalPages = computed(() => {
    const total = this.platformTotalElements();
    const size = this.platformSize();
    return size > 0 ? Math.ceil(total / size) : 0;
  });
  readonly platformLoading = signal(true);
  readonly platformError = signal<string | null>(null);
  readonly failedPlatformCoverIds = signal<ReadonlySet<string>>(new Set());
  readonly coverUrl = coverUrl;

  // Normalized LibraryCardItem collections
  readonly personalCardItems = computed<LibraryCardItem[]>(() =>
    this.readings().map((reading) => this.toPersonalCardItem(reading))
  );

  readonly documentCardItems = computed<LibraryCardItem[]>(() =>
    this.documents().map((doc) => this.toDocumentCardItem(doc))
  );

  readonly platformCardItems = computed<LibraryCardItem[]>(() =>
    this.platformReadings().map((item) => this.toPlatformCardItem(item))
  );

  readonly displayedCardItems = computed<LibraryCardItem[]>(() => {
    const filter = this.activeFilter();
    if (filter === 'all') {
      return [...this.personalCardItems(), ...this.documentCardItems()];
    }
    if (filter === 'personal') {
      return this.personalCardItems();
    }
    if (filter === 'ebooks') {
      return this.documentCardItems().filter((item) => item.type === 'EPUB');
    }
    if (filter === 'pdfs') {
      return this.documentCardItems().filter((item) => item.type === 'PDF');
    }
    return [];
  });

  // Keep for backward compatibility with specs
  readonly visibleReadingCards = computed(() =>
    this.activeFilter() === 'all' || this.activeFilter() === 'personal'
      ? this.readingCards()
      : []
  );
  readonly visibleDocuments = computed(() =>
    this.activeFilter() === 'all'
      ? this.documents()
      : this.activeFilter() === 'ebooks'
        ? this.documents().filter((document) => document.format === 'EPUB')
        : this.activeFilter() === 'pdfs'
          ? this.documents().filter((document) => document.format === 'PDF')
          : []
  );

  ngOnInit(): void {
    this.document.addEventListener('pointerdown', this.outsidePointerDownHandler, true);
    this.loadReadings();
    this.loadDocuments();
    this.loadPlatformHistory(0);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('pointerdown', this.outsidePointerDownHandler, true);
    this.closeActionMenu();
    this.deletionTarget.set(null);
    this.deleteError.set(null);
    this.destroy$.next();
    this.destroy$.complete();
    this.clearDocumentCovers();
  }

  loadDocuments(): void {
    this.clearDocumentCovers();
    this.documentsLoading.set(true);
    this.documentsError.set(null);
    this.documentService.list(0, 20).pipe(takeUntil(this.destroy$)).subscribe({
      next: (page) => {
        this.documents.set(page.content);
        this.documentCount.set(page.totalElements);
        page.content.filter((document) => document.coverAvailable).forEach((document) => this.loadDocumentCover(document.documentId));
        this.documentsLoading.set(false);
      },
      error: () => {
        this.documentsError.set('No pudimos cargar los libros importados.');
        this.documentsLoading.set(false);
      },
    });
  }

  markDocumentCoverFailed(documentId: string): void {
    this.failedDocumentCoverIds.update((current) => new Set(current).add(documentId));
    const url = this.documentCoverUrls()[documentId];
    if (url) URL.revokeObjectURL(url);
    this.documentCoverUrls.update((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }

  loadReadings(): void {
    this.loading.set(true);
    this.error.set(null);

    this.libraryService.listUserReadings().subscribe({
      next: (response) => {
        this.readingsPage.set(this.libraryService.parseUserReadings(response));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus lecturas');
        this.loading.set(false);
      },
    });
  }

  markCoverFailed(readingId: string): void {
    this.failedCoverIds.update((current) => {
      const next = new Set(current);
      next.add(readingId);
      return next;
    });
  }

  loadPlatformHistory(page = 0): void {
    this.platformLoading.set(true);
    this.platformError.set(null);

    this.libraryService
      .listPlatformReadingHistory(page, this.platformSize())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.platformHistoryPage.set(
            this.libraryService.parsePlatformReadingHistory(response)
          );
          this.platformPage.set(page);
          this.platformLoading.set(false);
        },
        error: () => {
          this.platformError.set('No pudimos cargar las lecturas de la plataforma.');
          this.platformLoading.set(false);
        },
      });
  }

  goToPlatformPage(page: number): void {
    if (page >= 0 && page < this.platformTotalPages()) {
      this.loadPlatformHistory(page);
    }
  }

  markPlatformCoverFailed(readingId: string): void {
    this.failedPlatformCoverIds.update((current) => {
      const next = new Set(current);
      next.add(readingId);
      return next;
    });
  }

  setFilter(filter: LibraryFilter): void {
    this.closeActionMenu();
    this.activeFilter.set(filter);
  }

  canReadDocument(document: ImportedDocument): boolean {
    return document.status === 'READY';
  }

  documentStatusLabel(document: ImportedDocument): string {
    if (document.status === 'PROCESSING') return 'Procesando…';
    if (document.status === 'FAILED') return 'No disponible';
    return document.progressStatus === 'COMPLETED'
      ? '✓ Leída'
      : document.progressStatus === 'IN_PROGRESS'
        ? 'En progreso'
        : 'Sin empezar';
  }

  documentCtaLabel(document: ImportedDocument): string | null {
    if (!this.canReadDocument(document)) return null;
    return document.progressStatus === 'COMPLETED'
      ? 'Releer →'
      : document.progressStatus === 'IN_PROGRESS'
        ? 'Continuar →'
        : 'Leer →';
  }

  readingActionKey(readingId: string): string {
    return `reading:${readingId}`;
  }

  documentActionKey(documentId: string): string {
    return `document:${documentId}`;
  }

  toggleActionMenu(key: string, trigger: EventTarget | null = null): void {
    const isClosing = this.openActionMenuKey() === key;
    const triggerElement = trigger instanceof HTMLElement ? trigger : null;
    this.openActionMenuKey.set(isClosing ? null : key);
    this.actionMenuTrigger = isClosing ? null : triggerElement;
    this.actionMenuContainer = isClosing
      ? null
      : triggerElement?.closest<HTMLElement>('[data-library-actions]') ?? null;
  }

  closeActionMenu(restoreFocus = false): void {
    const trigger = this.actionMenuTrigger;
    this.openActionMenuKey.set(null);
    this.actionMenuTrigger = null;
    this.actionMenuContainer = null;
    if (restoreFocus) trigger?.focus();
  }

  @HostListener('document:keydown.escape')
  closeActionMenuOnEscape(): void {
    const openTrigger = this.document.querySelector<HTMLElement>('.document-actions-trigger[aria-expanded="true"]');
    this.closeActionMenu();
    openTrigger?.focus();
  }

  requestReadingDeletion(reading: UserReading): void {
    this.openDeletionConfirmation({ type: 'reading', reading });
  }

  requestDocumentDeletion(document: ImportedDocument): void {
    if (document.status === 'PROCESSING') return;
    this.openDeletionConfirmation({ type: 'document', document });
  }

  cancelDeletion(): void {
    const target = this.deletionTarget();
    if (target && this.deletingTargetKeys().has(this.targetKey(target))) return;
    this.deletionTarget.set(null);
    this.deleteError.set(null);
  }

  confirmDeletion(): void {
    const target = this.deletionTarget();
    if (!target) return;
    const key = this.targetKey(target);
    if (this.deletingTargetKeys().has(key)) return;

    this.deletingTargetKeys.update((current) => new Set(current).add(key));
    this.deleteError.set(null);
    const operation: Observable<DeleteReadingResponse | void> = target.type === 'reading'
      ? this.libraryService.deleteReading(target.reading.readingId)
      : this.documentService.deleteDocument(target.document.documentId);
    operation.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.deletingTargetKeys.update((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      }))
    ).subscribe({
      next: (response) => {
        if (target.type === 'reading' && response && !response.success) {
          this.deleteError.set('No pudimos eliminar la lectura. Inténtalo nuevamente.');
          return;
        }
        this.removeTargetLocally(target);
      },
      error: (error: unknown) => {
        if (target.type === 'reading') {
          if (error instanceof ReadingNotFoundSoapError) {
            this.removeTargetLocally(target);
            return;
          }
          this.deleteError.set('No pudimos eliminar la lectura. Comprueba tu conexión e inténtalo nuevamente.');
          return;
        }
        if (error instanceof HttpErrorResponse && isDocumentNotFoundError(error)) {
          this.removeTargetLocally(target);
          return;
        }
        this.deleteError.set(error instanceof HttpErrorResponse && isDocumentProcessingError(error)
          ? 'Este documento todavía se está procesando. Espera a que termine antes de eliminarlo.'
          : 'No pudimos eliminar el documento. Comprueba tu conexión e inténtalo nuevamente.');
      },
    });
  }

  isDeleting(target: LibraryDeletionTarget): boolean {
    return this.deletingTargetKeys().has(this.targetKey(target));
  }

  deletionTitle(target: LibraryDeletionTarget): string {
    return target.type === 'reading' ? target.reading.title : target.document.title;
  }

  // Normalizer methods
  toPersonalCardItem(reading: UserReading): LibraryCardItem {
    const cardMetrics = toVocabularyCard(reading);
    const formattedDate = reading.createdAt ? this.datePipe.transform(reading.createdAt, 'd MMM y') : null;
    return {
      id: reading.readingId,
      type: 'USER',
      title: reading.title,
      subtitle: formattedDate ? `Añadida ${formattedDate}` : null,
      badge: 'LECTURA',
      isPlatformLevel: false,
      category: null,
      coverUrl: this.failedCoverIds().has(reading.readingId) ? null : this.textCoverUrl(reading.readingId),
      coverFitMode: 'cover',
      coverFallbackUrl: null,
      coverAlt: `Portada de ${reading.title}`,
      routerLink: ['/reading', reading.readingId],
      isUnavailable: false,
      vocabularyFitPercentage: reading.vocabularyFitPercentage ?? null,
      vocabularyFitTone: cardMetrics.fitTone,
      progressStatus: reading.progressStatus ?? 'NOT_STARTED',
      progressPercentage: null,
      statusLabel: reading.progressStatus === 'COMPLETED' ? '✓ Leída' : reading.progressStatus === 'IN_PROGRESS' ? 'En progreso' : 'Sin empezar',
      ctaLabel: reading.progressStatus === 'COMPLETED' ? 'Releer →' : reading.progressStatus === 'IN_PROGRESS' ? 'Continuar →' : 'Leer →',
      actionKey: this.readingActionKey(reading.readingId),
      canDelete: true,
    };
  }

  toDocumentCardItem(doc: ImportedDocument): LibraryCardItem {
    const isEpub = doc.format === 'EPUB';
    const coverUrl = !this.failedDocumentCoverIds().has(doc.documentId)
      ? this.documentCoverUrls()[doc.documentId] ?? null
      : null;
    const fallbackUrl = isEpub
      ? '/assets/reading-covers/documents/epub-fallback.svg'
      : '/assets/reading-covers/documents/pdf-fallback.svg';
    const isReady = this.canReadDocument(doc);
    const formattedDate = doc.createdAt ? this.datePipe.transform(doc.createdAt, 'd MMM y') : null;
    const subtitle = doc.author
      ? (doc.author.startsWith('Por ') ? doc.author : `Por ${doc.author}`)
      : (formattedDate ? `Añadido ${formattedDate}` : null);

    return {
      id: doc.documentId,
      type: isEpub ? 'EPUB' : 'PDF',
      title: doc.title,
      subtitle,
      badge: isEpub ? 'EPUB' : 'PDF',
      isPlatformLevel: false,
      category: null,
      coverUrl,
      coverFitMode: 'contain',
      coverFallbackUrl: fallbackUrl,
      coverAlt: `Portada de ${doc.title}`,
      routerLink: isReady ? ['/documents', doc.documentId, 'read'] : null,
      isUnavailable: !isReady,
      unavailableLabel: this.documentStatusLabel(doc),
      vocabularyFitPercentage: null,
      progressStatus: isReady ? (doc.progressStatus ?? 'NOT_STARTED') : null,
      progressPercentage: null,
      statusLabel: this.documentStatusLabel(doc),
      ctaLabel: this.documentCtaLabel(doc),
      actionKey: this.documentActionKey(doc.documentId),
      canDelete: doc.status !== 'PROCESSING',
    };
  }

  toPlatformCardItem(item: PlatformReadingHistoryItem): LibraryCardItem {
    return {
      id: item.readingId,
      type: 'PLATFORM',
      title: item.title,
      subtitle: null,
      badge: item.editorialLevel,
      isPlatformLevel: true,
      category: item.category,
      coverUrl: !this.failedPlatformCoverIds().has(item.readingId) && item.coverKey ? this.coverUrl(item.coverKey) : null,
      coverFitMode: 'cover',
      coverFallbackUrl: null,
      coverAlt: `Portada de ${item.title}`,
      routerLink: ['/reading', item.readingId],
      isUnavailable: false,
      vocabularyFitPercentage: null,
      progressStatus: item.progressStatus ?? 'NOT_STARTED',
      progressPercentage: null,
      statusLabel: item.progressStatus === 'COMPLETED' ? '✓ Leída' : 'En progreso',
      ctaLabel: item.progressStatus === 'COMPLETED' ? 'Releer →' : 'Continuar →',
      actionKey: null,
      canDelete: false,
    };
  }

  onDeleteRequested(card: LibraryCardItem): void {
    if (card.type === 'USER') {
      const reading = this.readings().find((r) => r.readingId === card.id);
      if (reading) this.requestReadingDeletion(reading);
    } else if (card.type === 'EPUB' || card.type === 'PDF') {
      const doc = this.documents().find((d) => d.documentId === card.id);
      if (doc) this.requestDocumentDeletion(doc);
    }
  }

  onCardCoverError(card: LibraryCardItem): void {
    if (card.type === 'USER') {
      this.markCoverFailed(card.id);
    } else if (card.type === 'EPUB' || card.type === 'PDF') {
      this.markDocumentCoverFailed(card.id);
    }
  }

  onPlatformCoverError(card: LibraryCardItem): void {
    this.markPlatformCoverFailed(card.id);
  }

  private loadDocumentCover(documentId: string): void {
    this.documentService.getCover(documentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.documentCoverUrls.update((current) => {
          const previous = current[documentId];
          if (previous && previous !== url) URL.revokeObjectURL(previous);
          return { ...current, [documentId]: url };
        });
      },
      error: () => this.markDocumentCoverFailed(documentId),
    });
  }

  private clearDocumentCovers(): void {
    Object.values(this.documentCoverUrls()).forEach((url) => URL.revokeObjectURL(url));
    this.documentCoverUrls.set({});
    this.failedDocumentCoverIds.set(new Set());
  }

  private removeDocumentLocally(documentId: string): void {
    const coverUrl = this.documentCoverUrls()[documentId];
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    this.documentCoverUrls.update((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
    this.failedDocumentCoverIds.update((current) => {
      const next = new Set(current);
      next.delete(documentId);
      return next;
    });
    this.documents.update((current) => current.filter((document) => document.documentId !== documentId));
    this.documentCount.update((current) => Math.max(0, current - 1));
    this.openActionMenuKey.set(null);
    this.deletionTarget.set(null);
    this.deleteError.set(null);
  }

  private openDeletionConfirmation(target: LibraryDeletionTarget): void {
    if (this.deletingTargetKeys().has(this.targetKey(target))) return;
    this.openActionMenuKey.set(null);
    this.deleteError.set(null);
    this.deletionTarget.set(target);
  }

  private targetKey(target: LibraryDeletionTarget): string {
    return target.type === 'reading'
      ? this.readingActionKey(target.reading.readingId)
      : this.documentActionKey(target.document.documentId);
  }

  private removeTargetLocally(target: LibraryDeletionTarget): void {
    if (target.type === 'reading') {
      this.readingsPage.update((page) => page ? {
        ...page,
        totalElements: Math.max(0, page.totalElements - 1),
        readings: page.readings.filter((reading) => reading.readingId !== target.reading.readingId),
      } : null);
      this.openActionMenuKey.set(null);
      this.deletionTarget.set(null);
      this.deleteError.set(null);
      return;
    }
    this.removeDocumentLocally(target.document.documentId);
  }
}
