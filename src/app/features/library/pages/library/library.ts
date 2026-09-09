import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DeleteReadingResponse, UserReading, UserReadingsPage } from '../../models/library.models';
import { LibraryService, ReadingNotFoundSoapError } from '../../services/library';
import { toVocabularyCard } from '../../../../shared/utils/reading-metrics';
import { userTextCoverUrl } from '../../../../shared/utils/user-text-cover';
import { ImportedDocument } from '../../../documents/models/document.models';
import { DocumentService } from '../../../documents/services/document';
import { isDocumentNotFoundError, isDocumentProcessingError } from '../../../documents/utils/document-errors';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';

type LibraryFilter = 'all' | 'personal' | 'ebooks' | 'pdfs';
type LibraryDeletionTarget =
  | { type: 'reading'; reading: UserReading }
  | { type: 'document'; document: ImportedDocument };

@Component({
  selector: 'app-library',
  imports: [DatePipe, RouterLink],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class Library implements OnInit, OnDestroy {
  private readonly libraryService = inject(LibraryService);
  private readonly documentService = inject(DocumentService);
  private readonly destroy$ = new Subject<void>();

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
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly failedCoverIds = signal(new Set<string>());
  readonly textCoverUrl = userTextCoverUrl;

  ngOnInit(): void {
    this.loadReadings();
    this.loadDocuments();
  }

  ngOnDestroy(): void {
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

  setFilter(filter: LibraryFilter): void {
    this.activeFilter.set(filter);
  }

  canReadDocument(document: ImportedDocument): boolean {
    return document.status === 'READY';
  }

  documentStatusLabel(document: ImportedDocument): string {
    if (document.status === 'PROCESSING') return 'Procesando…';
    if (document.status === 'FAILED') return 'No disponible';
    return document.progressStatus === 'COMPLETED'
      ? 'Leído'
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

  toggleActionMenu(key: string): void {
    this.openActionMenuKey.update((current) => current === key ? null : key);
  }

  closeActionMenu(): void {
    this.openActionMenuKey.set(null);
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
