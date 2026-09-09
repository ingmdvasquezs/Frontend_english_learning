import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LibraryService } from '../../services/library';
import { ImportedDocument } from '../../../documents/models/document.models';
import { DocumentService } from '../../../documents/services/document';
import { documentFailureMessage, isDocumentAlreadyImportedError } from '../../../documents/utils/document-errors';

@Component({
  selector: 'app-new-reading',
  imports: [RouterLink],
  templateUrl: './new-reading.html',
  styleUrl: './new-reading.css',
})
export class NewReading implements OnDestroy {
  readonly maxTitleLength = 200;
  readonly maxContentLength = 1_048_576;

  private readonly libraryService = inject(LibraryService);
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly title = signal('');
  readonly content = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sourceType = signal<'TEXT' | 'DOCUMENT'>('TEXT');
  readonly selectedDocument = signal<File | null>(null);
  readonly documentError = signal<string | null>(null);
  readonly importing = signal(false);
  readonly importedDocument = signal<ImportedDocument | null>(null);
  readonly languageRequired = signal(false);
  readonly maxDocumentBytes = 50 * 1024 * 1024;

  readonly canSubmit = computed(
    () =>
      this.title().trim().length > 0 &&
      this.title().length <= this.maxTitleLength &&
      this.content().trim().length > 0 &&
      this.content().length <= this.maxContentLength &&
      !this.loading()
  );

  onTitleChange(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onContentChange(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectSource(source: 'TEXT' | 'DOCUMENT'): void {
    this.sourceType.set(source);
    this.error.set(null);
    this.documentError.set(null);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.validateDocument(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.validateDocument(event.dataTransfer?.files[0] ?? null);
  }

  clearDocument(): void {
    if (this.importing()) return;
    this.selectedDocument.set(null);
    this.documentError.set(null);
    this.importedDocument.set(null);
    this.languageRequired.set(false);
  }

  formatFileSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  uploadDocument(languageOverride?: 'en'): void {
    const file = this.selectedDocument();
    if (!file || this.importing()) return;
    this.importing.set(true);
    this.documentError.set(null);
    this.languageRequired.set(false);
    this.documentService.upload(file, languageOverride).pipe(takeUntil(this.destroy$)).subscribe({
      next: (accepted) => {
        this.documentService.pollUntilTerminal(accepted.documentId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (document) => {
            this.importedDocument.set(document);
            if (document.status === 'FAILED') {
              this.documentError.set(documentFailureMessage(document.failureReason));
              this.languageRequired.set(document.failureReason === 'LANGUAGE_REQUIRED');
              this.importing.set(false);
            } else if (document.status === 'READY') {
              this.importing.set(false);
            }
          },
          error: () => {
            this.documentError.set('La importación está tardando más de lo esperado. Inténtalo nuevamente.');
            this.importing.set(false);
          },
        });
      },
      error: (response: HttpErrorResponse) => {
        if (isDocumentAlreadyImportedError(response)) {
          this.documentError.set('Este libro ya está en tu biblioteca. Ya importaste este archivo o todavía se está procesando.');
          this.importing.set(false);
          return;
        }
        const code = this.failureCodeFrom(response);
        this.documentError.set(documentFailureMessage(code));
        this.languageRequired.set(code === 'LANGUAGE_REQUIRED');
        this.importing.set(false);
      },
    });
  }

  createReading(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.libraryService
      .registerReading(this.title().trim(), this.content().trim(), 'en')
      .subscribe({
        next: (response) => {
          this.libraryService.parseRegisteredReadingResponse(response);

          void this.router.navigateByUrl('/library');
        },
        error: () => {
          this.error.set('No se pudo registrar la lectura');
          this.loading.set(false);
        },
      });
  }

  private validateDocument(file: File | null): void {
    this.importedDocument.set(null);
    this.languageRequired.set(false);
    if (!file || !this.isSupportedDocument(file)) {
      this.selectedDocument.set(null);
      this.documentError.set('Selecciona un archivo EPUB o PDF válido.');
      return;
    }
    if (file.size > this.maxDocumentBytes) {
      this.selectedDocument.set(null);
      this.documentError.set('El archivo supera el tamaño permitido.');
      return;
    }
    this.selectedDocument.set(file);
    this.documentError.set(null);
  }

  private isSupportedDocument(file: File): boolean {
    const extension = file.name.toLowerCase().match(/\.(epub|pdf)$/)?.[1];
    if (!extension) return false;

    const mime = file.type.toLowerCase();
    if (!mime || mime === 'application/octet-stream') return true;

    const acceptedMimes = extension === 'epub'
      ? ['application/epub+zip', 'application/zip']
      : ['application/pdf', 'application/x-pdf'];
    return acceptedMimes.includes(mime);
  }

  private failureCodeFrom(response: HttpErrorResponse) {
    const error = response.error as { code?: unknown; failureReason?: unknown } | null;
    const value = error?.code ?? error?.failureReason;
    return typeof value === 'string' && [
      'INVALID_EPUB','UNSUPPORTED_DRM','LANGUAGE_REQUIRED','UNSUPPORTED_LANGUAGE',
      'FILE_TOO_LARGE','SECURITY_LIMIT_EXCEEDED','STORAGE_FAILURE','IMPORT_FAILURE',
      'INVALID_PDF','PDF_PASSWORD_PROTECTED','PDF_SCANNED_NOT_SUPPORTED',
    ].includes(value) ? value as ImportedDocument['failureReason'] : null;
  }
}
