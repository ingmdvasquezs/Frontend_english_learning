import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { LibraryService } from '../../services/library';
import {
  CreateDocumentUploadRequest,
  DocumentDirectUploadState,
  ImportedDocument,
  UploadErrorPhase,
} from '../../../documents/models/document.models';
import { DocumentService } from '../../../documents/services/document';
import {
  confirmErrorMessage,
  documentFailureMessage,
  isConfirmRetryableError,
  isDocumentAlreadyImportedError,
  isUploadNotCompletedError,
  uploadPhaseErrorMessage,
} from '../../../documents/utils/document-errors';
import { calculateFileSha256 } from '../../../documents/utils/document-checksum';
import { DOCUMENT_UPLOAD_CONFIG } from '../../../documents/config/document-upload.config';

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
  private readonly uploadConfig = inject(DOCUMENT_UPLOAD_CONFIG);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private activeUploadSub: Subscription | null = null;
  private savedLanguageOverride?: 'en';

  readonly directUploadEnabled = computed(() => this.uploadConfig.documentDirectUploadEnabled);

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

  // Direct upload state machine
  readonly uploadState = signal<DocumentDirectUploadState>('IDLE');
  readonly uploadProgressPercent = signal<number>(0);
  readonly uploadCompleted = signal<boolean>(false);
  readonly currentUploadId = signal<string | null>(null);
  readonly currentDocumentId = signal<string | null>(null);
  readonly errorPhase = signal<UploadErrorPhase | null>(null);
  readonly confirmRetryable = signal<boolean>(false);
  readonly uploadNotCompleted = signal<boolean>(false);

  readonly canSubmit = computed(
    () =>
      this.title().trim().length > 0 &&
      this.title().length <= this.maxTitleLength &&
      this.content().trim().length > 0 &&
      this.content().length <= this.maxContentLength &&
      !this.loading()
  );

  readonly canRetryConfirm = computed(
    () =>
      this.directUploadEnabled() &&
      this.uploadCompleted() &&
      this.uploadState() === 'FAILED' &&
      this.errorPhase() === 'CONFIRM_FAILED' &&
      this.confirmRetryable() &&
      !!this.currentUploadId()
  );

  readonly canRetryUpload = computed(
    () =>
      this.directUploadEnabled() &&
      this.uploadState() === 'FAILED' &&
      this.uploadNotCompleted() &&
      !!this.currentUploadId()
  );

  readonly canCancelUpload = computed(
    () =>
      this.directUploadEnabled() &&
      ['HASHING', 'REQUESTING_UPLOAD', 'UPLOADING'].includes(this.uploadState())
  );

  readonly isCancelDisabled = computed(
    () => this.importing() && !this.canCancelUpload()
  );

  readonly importStatusTitle = computed(() => {
    if (!this.directUploadEnabled()) {
      return 'Estamos preparando tu documento…';
    }
    switch (this.uploadState()) {
      case 'HASHING':
        return 'Preparando archivo…';
      case 'REQUESTING_UPLOAD':
        return 'Solicitando carga…';
      case 'UPLOADING':
        return `Subiendo archivo ${this.uploadProgressPercent()}%`;
      case 'CONFIRMING':
        return 'Confirmando archivo…';
      case 'PROCESSING':
        return 'Procesando libro…';
      default:
        return 'Estamos preparando tu documento…';
    }
  });

  readonly importStatusDescription = computed(() => {
    if (this.directUploadEnabled() && this.uploadState() === 'PROCESSING') {
      return 'Esto puede tardar unos momentos mientras extraemos el contenido.';
    }
    return 'Esto puede tardar unos momentos.';
  });

  onTitleChange(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onContentChange(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  ngOnDestroy(): void {
    this.activeUploadSub?.unsubscribe();
    this.activeUploadSub = null;
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
    if (this.importing() && !this.canCancelUpload()) return;
    this.cancelUpload();
    this.selectedDocument.set(null);
    this.documentError.set(null);
    this.importedDocument.set(null);
    this.languageRequired.set(false);
  }

  cancelUpload(): void {
    this.activeUploadSub?.unsubscribe();
    this.activeUploadSub = null;
    this.uploadState.set('IDLE');
    this.importing.set(false);
    this.uploadProgressPercent.set(0);
    this.uploadCompleted.set(false);
    this.currentUploadId.set(null);
    this.currentDocumentId.set(null);
    this.errorPhase.set(null);
    this.documentError.set(null);
    this.confirmRetryable.set(false);
    this.uploadNotCompleted.set(false);
  }

  cancelOrClearDocument(): void {
    if (this.canCancelUpload()) {
      this.cancelUpload();
    } else {
      this.clearDocument();
    }
  }

  formatFileSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async uploadDocument(languageOverride?: 'en'): Promise<void> {
    const file = this.selectedDocument();
    if (!file || this.importing()) return;

    if (file.size > this.maxDocumentBytes) {
      this.selectedDocument.set(null);
      this.documentError.set('El archivo supera el tamaño permitido.');
      return;
    }

    if (this.directUploadEnabled()) {
      await this.startDirectUpload(file, languageOverride);
    } else {
      this.startLegacyUpload(file, languageOverride);
    }
  }

  retryConfirm(): void {
    const uploadId = this.currentUploadId();
    const documentId = this.currentDocumentId();
    if (!uploadId || !this.uploadCompleted()) return;

    this.importing.set(true);
    this.documentError.set(null);
    this.errorPhase.set(null);
    this.executeConfirm(uploadId, documentId ?? '');
  }

  retryUpload(): void {
    const uploadId = this.currentUploadId();
    const documentId = this.currentDocumentId();
    const file = this.selectedDocument();
    if (!uploadId || !documentId) return;

    if (!file) {
      this.documentError.set('Por favor, selecciona nuevamente el archivo para completar la subida.');
      return;
    }

    this.uploadNotCompleted.set(false);
    this.importing.set(true);
    this.documentError.set(null);
    this.errorPhase.set(null);
    this.refreshAndRetryPut(uploadId, documentId, file);
  }

  retryLanguageRequired(): void {
    if (!this.directUploadEnabled()) {
      this.uploadDocument('en');
      return;
    }
    this.requestLanguageReprocess('en');
  }

  /**
   * Prepares a language-specific reprocess request for direct uploads.
   *
   * TODO: Backend durable reprocess endpoint required (e.g. POST /api/v1/documents/{documentId}/reprocess).
   * Once available on backend, this method will dispatch the reprocess request using documentId and languageOverride
   * without re-calculating SHA256, without creating a new upload intent, without re-uploading bytes to S3,
   * and without re-calling confirmUpload (which is an idempotent terminal status in the backend).
   */
  requestLanguageReprocess(languageOverride: 'en' = 'en'): void {
    const documentId = this.currentDocumentId();
    if (!documentId) return;

    this.savedLanguageOverride = languageOverride;
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

  private startLegacyUpload(file: File, languageOverride?: 'en'): void {
    this.importing.set(true);
    this.documentError.set(null);
    this.languageRequired.set(false);
    this.activeUploadSub = this.documentService
      .upload(file, languageOverride)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (accepted) => {
          this.documentService
            .pollUntilTerminal(accepted.documentId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
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
            this.documentError.set(
              'Este libro ya está en tu biblioteca. Ya importaste este archivo o todavía se está procesando.'
            );
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

  private async startDirectUpload(file: File, languageOverride?: 'en'): Promise<void> {
    this.savedLanguageOverride = languageOverride;
    this.importing.set(true);
    this.uploadState.set('HASHING');
    this.uploadProgressPercent.set(0);
    this.uploadCompleted.set(false);
    this.currentUploadId.set(null);
    this.currentDocumentId.set(null);
    this.errorPhase.set(null);
    this.documentError.set(null);
    this.languageRequired.set(false);
    this.confirmRetryable.set(false);
    this.uploadNotCompleted.set(false);

    let sha256: string;
    try {
      sha256 = await calculateFileSha256(file);
    } catch {
      this.uploadState.set('FAILED');
      this.errorPhase.set('HASH_FAILED');
      this.importing.set(false);
      this.documentError.set(uploadPhaseErrorMessage('HASH_FAILED'));
      return;
    }

    if (this.uploadState() !== 'HASHING') return;

    this.uploadState.set('REQUESTING_UPLOAD');
    const contentType =
      file.type && file.type !== 'application/octet-stream'
        ? file.type
        : file.name.toLowerCase().endsWith('.epub')
          ? 'application/epub+zip'
          : 'application/pdf';

    const request: CreateDocumentUploadRequest = {
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      checksumSha256: sha256,
    };

    const sub = this.documentService
      .createUploadIntent(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (intent) => {
          this.currentUploadId.set(intent.uploadId);
          this.currentDocumentId.set(intent.documentId);
          this.executeDirectPut(intent.uploadUrl, file, intent.requiredHeaders, intent.uploadId, intent.documentId);
        },
        error: (error: HttpErrorResponse) => {
          if (isDocumentAlreadyImportedError(error)) {
            this.documentError.set(
              'Este libro ya está en tu biblioteca. Ya importaste este archivo o todavía se está procesando.'
            );
          } else {
            this.documentError.set(uploadPhaseErrorMessage('CREATE_INTENT_FAILED'));
          }
          this.uploadState.set('FAILED');
          this.errorPhase.set('CREATE_INTENT_FAILED');
          this.importing.set(false);
        },
      });

    if (this.uploadState() === 'REQUESTING_UPLOAD') {
      this.activeUploadSub = sub;
    }
  }

  private executeDirectPut(
    uploadUrl: string,
    file: File,
    requiredHeaders: Record<string, string>,
    uploadId: string,
    documentId: string,
    isRetry = false
  ): void {
    this.uploadState.set('UPLOADING');
    this.activeUploadSub = this.documentService
      .uploadDirect(uploadUrl, file, requiredHeaders)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: HttpEvent<unknown>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const progress = Math.round((event.loaded * 100) / event.total);
            this.uploadProgressPercent.set(progress);
          } else if (event.type === HttpEventType.Response) {
            this.uploadCompleted.set(true);
            this.uploadProgressPercent.set(100);
            this.executeConfirm(uploadId, documentId);
          }
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 412 && uploadId) {
            this.uploadCompleted.set(true);
            this.uploadProgressPercent.set(100);
            this.executeConfirm(uploadId, documentId);
            return;
          }
          if (!isRetry && (err.status === 403 || err.status === 401)) {
            this.refreshAndRetryPut(uploadId, documentId, file);
            return;
          }
          this.uploadState.set('FAILED');
          this.errorPhase.set(err.status === 403 ? 'PRESIGN_EXPIRED' : 'UPLOAD_FAILED');
          this.importing.set(false);
          this.documentError.set(uploadPhaseErrorMessage(err.status === 403 ? 'PRESIGN_EXPIRED' : 'UPLOAD_FAILED'));
        },
      });
  }

  private refreshAndRetryPut(uploadId: string, documentId: string, file: File): void {
    const sub = this.documentService
      .refreshUploadAuthorization(uploadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (refreshed) => {
          this.executeDirectPut(refreshed.uploadUrl, file, refreshed.requiredHeaders, uploadId, documentId, true);
        },
        error: () => {
          this.uploadState.set('FAILED');
          this.errorPhase.set('PRESIGN_EXPIRED');
          this.importing.set(false);
          this.documentError.set(uploadPhaseErrorMessage('PRESIGN_EXPIRED'));
        },
      });

    if (this.uploadState() !== 'UPLOADING') {
      this.activeUploadSub = sub;
    }
  }

  private executeConfirm(uploadId: string, documentId: string): void {
    this.uploadState.set('CONFIRMING');
    this.confirmRetryable.set(false);
    this.uploadNotCompleted.set(false);
    const sub = this.documentService
      .confirmUpload(uploadId, this.savedLanguageOverride)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (confirmRes) => {
          this.uploadState.set('PROCESSING');
          this.startDirectPolling(confirmRes.documentId || documentId);
        },
        error: (err: HttpErrorResponse) => {
          this.uploadState.set('FAILED');
          this.errorPhase.set('CONFIRM_FAILED');
          this.importing.set(false);

          if (isUploadNotCompletedError(err)) {
            this.uploadNotCompleted.set(true);
            this.confirmRetryable.set(false);
          } else if (isConfirmRetryableError(err)) {
            this.confirmRetryable.set(true);
          } else {
            this.confirmRetryable.set(false);
          }

          this.documentError.set(confirmErrorMessage(err));
        },
      });

    if (this.uploadState() === 'CONFIRMING') {
      this.activeUploadSub = sub;
    }
  }

  private startDirectPolling(documentId: string): void {
    this.activeUploadSub = this.documentService
      .pollUntilTerminal(documentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (document) => {
          this.importedDocument.set(document);
          if (document.status === 'FAILED') {
            this.uploadState.set('FAILED');
            this.errorPhase.set('PROCESSING_FAILED');
            this.documentError.set(documentFailureMessage(document.failureReason));
            this.languageRequired.set(document.failureReason === 'LANGUAGE_REQUIRED');
            this.importing.set(false);
          } else if (document.status === 'READY') {
            this.uploadState.set('READY');
            this.importing.set(false);
          }
        },
        error: () => {
          this.uploadState.set('FAILED');
          this.errorPhase.set('PROCESSING_FAILED');
          this.documentError.set('La importación está tardando más de lo esperado. Inténtalo nuevamente.');
          this.importing.set(false);
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

    const acceptedMimes =
      extension === 'epub'
        ? ['application/epub+zip', 'application/zip']
        : ['application/pdf', 'application/x-pdf'];
    return acceptedMimes.includes(mime);
  }

  private failureCodeFrom(response: HttpErrorResponse) {
    const error = response.error as { code?: unknown; failureReason?: unknown } | null;
    const value = error?.code ?? error?.failureReason;
    return typeof value === 'string' &&
      [
        'INVALID_EPUB',
        'UNSUPPORTED_DRM',
        'LANGUAGE_REQUIRED',
        'UNSUPPORTED_LANGUAGE',
        'FILE_TOO_LARGE',
        'SECURITY_LIMIT_EXCEEDED',
        'STORAGE_FAILURE',
        'IMPORT_FAILURE',
        'INVALID_PDF',
        'PDF_PASSWORD_PROTECTED',
        'PDF_SCANNED_NOT_SUPPORTED',
      ].includes(value)
      ? (value as ImportedDocument['failureReason'])
      : null;
  }
}
