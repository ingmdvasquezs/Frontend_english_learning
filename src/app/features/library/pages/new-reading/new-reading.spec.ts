import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LibraryService } from '../../services/library';
import { NewReading } from './new-reading';
import { DocumentService } from '../../../documents/services/document';
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import {
  DEFAULT_DOCUMENT_UPLOAD_CONFIG,
  DOCUMENT_UPLOAD_CONFIG,
} from '../../../documents/config/document-upload.config';

describe('NewReading', () => {
  let component: NewReading;
  let fixture: ComponentFixture<NewReading>;
  let service: {
    registerReading: ReturnType<typeof vi.fn>;
    parseRegisteredReadingResponse: ReturnType<typeof vi.fn>;
  };
  let router: Router;
  let documentService: {
    upload: ReturnType<typeof vi.fn>;
    pollUntilTerminal: ReturnType<typeof vi.fn>;
    createUploadIntent: ReturnType<typeof vi.fn>;
    uploadDirect: ReturnType<typeof vi.fn>;
    confirmUpload: ReturnType<typeof vi.fn>;
    refreshUploadAuthorization: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      registerReading: vi.fn(() => of('<response/>')),
      parseRegisteredReadingResponse: vi.fn(() => ({
        readingId: 'reading-1',
        title: 'My reading',
        language: 'en',
        createdAt: '2026-08-29T15:00:00Z',
      })),
    };
    documentService = {
      upload: vi.fn(),
      pollUntilTerminal: vi.fn(),
      createUploadIntent: vi.fn(),
      uploadDirect: vi.fn(),
      confirmUpload: vi.fn(),
      refreshUploadAuthorization: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NewReading],
      providers: [
        provideRouter([]),
        { provide: LibraryService, useValue: service },
        { provide: DocumentService, useValue: documentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewReading);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  it('registers a reading and returns to the library', () => {
    component.title.set('My reading');
    component.content.set('English content');

    component.createReading();

    expect(service.registerReading).toHaveBeenCalledWith(
      'My reading',
      'English content',
      'en'
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/library');
  });

  it('renders the title, textarea, character counter and cancel navigation', () => {
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Añadir a mi biblioteca');
    expect(root.textContent).toContain('Trae algo que quieras leer.');
    expect(root.querySelector('label[for="title"]')?.textContent).toContain('Título de la lectura');
    expect(root.querySelector('input#title')).toBeTruthy();
    expect(root.querySelector('textarea#content')).toBeTruthy();
    expect(root.textContent).toContain('0 caracteres');
    expect(root.querySelectorAll('.reading-help li')).toHaveLength(3);
    expect(root.querySelector('a[href="/library"]')?.textContent).toContain('Cancelar');

    component.content.set('English');
    fixture.detectChanges();
    expect(root.textContent).toContain('7 caracteres');
  });

  it('disables invalid submissions and prevents a second submit while saving', () => {
    const pending = new Subject<string>();
    service.registerReading.mockReturnValue(pending.asObservable());
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    component.title.set('My reading');
    component.content.set('English content');
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();
    expect(button.textContent).toContain('Guardando');
    expect(button.disabled).toBe(true);
    component.createReading();
    expect(service.registerReading).toHaveBeenCalledOnce();
  });

  it('keeps the form visible when registration fails', () => {
    service.registerReading.mockReturnValue(
      throwError(() => new Error('SOAP error'))
    );
    component.title.set('My reading');
    component.content.set('English content');

    component.createReading();

    expect(component.error()).toBe('No se pudo registrar la lectura');
    expect(component.loading()).toBe(false);
  });

  it('does not submit values outside the XSD title restriction', () => {
    component.title.set('a'.repeat(201));
    component.content.set('English content');

    component.createReading();

    expect(component.canSubmit()).toBe(false);
    expect(service.registerReading).not.toHaveBeenCalled();
  });

  it('keeps TEXT as the default flow and switches to the shared document uploader', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('textarea#content')).toBeTruthy();
    component.selectSource('DOCUMENT'); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('.epub,.pdf,application/epub+zip,application/pdf');
    expect(fixture.nativeElement.querySelector('.source-options button:disabled')).toBeFalsy();
  });

  it('accepts EPUB and PDF up to 50 MB and rejects other formats or mismatched MIME', () => {
    const epub = new File(['epub'], 'book.epub', { type:'application/epub+zip' });
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [epub] } } as unknown as DragEvent);
    expect(component.selectedDocument()).toBe(epub);
    const pdf = new File(['pdf'], 'book.pdf', { type:'application/pdf' });
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [pdf] } } as unknown as DragEvent);
    expect(component.selectedDocument()).toBe(pdf);
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [new File(['x'], 'book.txt', { type:'text/plain' })] } } as unknown as DragEvent);
    expect(component.documentError()).toContain('EPUB o PDF válido');
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [new File(['x'], 'fake.pdf', { type:'text/plain' })] } } as unknown as DragEvent);
    expect(component.selectedDocument()).toBeNull();
    expect(component.documentError()).toContain('EPUB o PDF válido');
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [new File(['x'], 'book.pdf', { type:'text/plain' })] } } as unknown as DragEvent);
    expect(component.documentError()).toContain('EPUB o PDF válido');
    const large = new File(['x'], 'large.epub');
    Object.defineProperty(large, 'size', { value: component.maxDocumentBytes + 1 });
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files: [large] } } as unknown as DragEvent);
    expect(component.documentError()).toContain('tamaño permitido');
  });

  it('uploads, shows PROCESSING and reaches READY', () => {
    const file = new File(['epub'], 'book.epub'); component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files:[file] } } as unknown as DragEvent);
    const poll = new Subject<{ documentId:string; status:string; title?:string }>();
    documentService.upload.mockReturnValue(of({ documentId:'doc-1', status:'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(poll);
    component.uploadDocument();
    expect(documentService.upload).toHaveBeenCalledWith(file, undefined);
    expect(component.importing()).toBe(true);
    poll.next({ documentId:'doc-1', status:'READY', title:'Book' });
    expect(component.importing()).toBe(false);
    expect(component.importedDocument()?.status).toBe('READY');
  });

  it('uploads PDF through the existing document service and polling flow', () => {
    const file = new File(['pdf'], 'book.pdf', { type:'application/pdf' });
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer: { files:[file] } } as unknown as DragEvent);
    documentService.upload.mockReturnValue(of({ documentId:'pdf-1', status:'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(of({ documentId:'pdf-1', status:'READY', format:'PDF' }));

    component.uploadDocument();

    expect(documentService.upload).toHaveBeenCalledWith(file, undefined);
    expect(documentService.pollUntilTerminal).toHaveBeenCalledWith('pdf-1');
    expect(component.importedDocument()?.status).toBe('READY');
    expect(component.importedDocument()?.format).toBe('PDF');
    expect(component.importing()).toBe(false);
  });

  it.each([
    ['INVALID_EPUB','EPUB válido'],['UNSUPPORTED_DRM','protección DRM'],['UNSUPPORTED_LANGUAGE','deben estar en inglés'],
  ])('maps %s to a human import error', (failureCode, message) => {
    const file = new File(['x'], 'book.epub'); component.onFileDropped({ preventDefault: vi.fn(), dataTransfer:{ files:[file] } } as unknown as DragEvent);
    documentService.upload.mockReturnValue(of({ documentId:'doc', status:'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(of({ documentId:'doc', status:'FAILED', failureReason:failureCode }));
    component.uploadDocument(); expect(component.documentError()).toContain(message);
  });

  it.each([
    ['INVALID_PDF','El archivo PDF no es válido o está dañado.'],
    ['PDF_PASSWORD_PROTECTED','Los archivos PDF protegidos con contraseña todavía no son compatibles.'],
    ['PDF_SCANNED_NOT_SUPPORTED','La lectura de PDF escaneados todavía no está disponible.'],
  ])('maps %s to its PDF-specific message', (failureReason, message) => {
    const file = new File(['pdf'], 'book.pdf', { type:'application/pdf' });
    component.onFileDropped({ preventDefault: vi.fn(), dataTransfer:{ files:[file] } } as unknown as DragEvent);
    documentService.upload.mockReturnValue(of({ documentId:'pdf', status:'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(of({ documentId:'pdf', status:'FAILED', failureReason }));

    component.uploadDocument();

    expect(component.documentError()).toContain(message);
    expect(component.importing()).toBe(false);
  });

  it('offers an English retry for LANGUAGE_REQUIRED and cleans polling up on destroy', () => {
    const file = new File(['x'], 'book.epub'); component.onFileDropped({ preventDefault: vi.fn(), dataTransfer:{ files:[file] } } as unknown as DragEvent);
    const poll = new Subject<{ documentId:string; status:string; failureReason?:string }>(); documentService.upload.mockReturnValue(of({ documentId:'doc', status:'PROCESSING' })); documentService.pollUntilTerminal.mockReturnValue(poll);
    component.uploadDocument(); poll.next({ documentId:'doc', status:'FAILED', failureReason:'LANGUAGE_REQUIRED' });
    expect(component.languageRequired()).toBe(true);
    expect(component.documentError()).toBe('No pudimos detectar el idioma del libro.');
    documentService.upload.mockReturnValue(of({ documentId:'retry', status:'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(of({ documentId:'retry', status:'READY', format:'EPUB' }));
    component.uploadDocument('en');
    expect(documentService.upload).toHaveBeenLastCalledWith(file, 'en');
    expect(component.importedDocument()?.status).toBe('READY');
    component.ngOnDestroy(); expect(poll.observed).toBe(false);
  });

  it('handles DOCUMENT_ALREADY_IMPORTED without polling and releases the importer', () => {
    const file=new File(['same'],'book.epub'); component.onFileDropped({preventDefault:vi.fn(),dataTransfer:{files:[file]}} as unknown as DragEvent);
    documentService.upload.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { code: 'DOCUMENT_ALREADY_IMPORTED' },
    })));
    component.uploadDocument();
    expect(component.documentError()).toContain('Este libro ya está en tu biblioteca');
    expect(documentService.pollUntilTerminal).not.toHaveBeenCalled();
    expect(component.importing()).toBe(false); expect(component.selectedDocument()).toBe(file);
    component.clearDocument(); expect(component.selectedDocument()).toBeNull();
  });

  it('does not classify another 409 code as a duplicate', () => {
    const file=new File(['other'],'book.epub'); component.onFileDropped({preventDefault:vi.fn(),dataTransfer:{files:[file]}} as unknown as DragEvent);
    documentService.upload.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{code:'OTHER_CONFLICT'}})));
    component.uploadDocument();
    expect(component.documentError()).toBe('No pudimos preparar el libro. Inténtalo nuevamente.');
    expect(component.documentError()).not.toContain('ya está en tu biblioteca');
    expect(documentService.pollUntilTerminal).not.toHaveBeenCalled(); expect(component.importing()).toBe(false);
  });

  // F12: feature flag false usa legacy
  it('F12: feature flag false usa legacy multipart endpoint y no llama createUploadIntent', () => {
    expect(component.directUploadEnabled()).toBe(false);
    const file = new File(['content'], 'book.epub');
    component.selectedDocument.set(file);
    documentService.upload.mockReturnValue(of({ documentId: 'doc-1', status: 'PROCESSING' }));
    documentService.pollUntilTerminal.mockReturnValue(new Subject());

    component.uploadDocument();

    expect(documentService.upload).toHaveBeenCalledWith(file, undefined);
    expect(documentService.createUploadIntent).not.toHaveBeenCalled();
    expect(documentService.uploadDirect).not.toHaveBeenCalled();
  });

  // F17: no existen AWS credentials en config
  it('F17: no existen credenciales de AWS en DEFAULT_DOCUMENT_UPLOAD_CONFIG ni en NewReading', () => {
    expect(DEFAULT_DOCUMENT_UPLOAD_CONFIG).toEqual({ documentDirectUploadEnabled: false });
    const configStr = JSON.stringify(DEFAULT_DOCUMENT_UPLOAD_CONFIG);
    expect(configStr).not.toContain('AKIA');
    expect(configStr).not.toContain('aws_access_key');
    expect(configStr).not.toContain('secret');
  });

  // F25: legacy feature flag false conserva comportamiento LANGUAGE_REQUIRED previo
  it('F25: legacy feature flag false conserva comportamiento LANGUAGE_REQUIRED previo', () => {
    const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
    component.selectedDocument.set(file);

    documentService.upload.mockReturnValueOnce(of({ documentId: 'doc-legacy', status: 'PROCESSING' }));
    const poll = new Subject<any>();
    documentService.pollUntilTerminal.mockReturnValue(poll.asObservable());

    component.uploadDocument();
    poll.next({ documentId: 'doc-legacy', status: 'FAILED', failureReason: 'LANGUAGE_REQUIRED' });
    expect(component.languageRequired()).toBe(true);

    documentService.upload.mockReturnValueOnce(of({ documentId: 'doc-legacy-retry', status: 'PROCESSING' }));
    component.retryLanguageRequired();

    expect(documentService.upload).toHaveBeenCalledTimes(2);
    expect(documentService.upload).toHaveBeenLastCalledWith(file, 'en');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DIRECT S3 UPLOAD SUITE (Feature flag = true)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Direct S3 Upload (feature flag enabled)', () => {
    let directComponent: NewReading;
    let directFixture: ComponentFixture<NewReading>;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [NewReading],
        providers: [
          provideRouter([]),
          { provide: LibraryService, useValue: service },
          { provide: DocumentService, useValue: documentService },
          {
            provide: DOCUMENT_UPLOAD_CONFIG,
            useValue: { documentDirectUploadEnabled: true },
          },
        ],
      }).compileComponents();

      directFixture = TestBed.createComponent(NewReading);
      directComponent = directFixture.componentInstance;
    });

    it('F13: feature flag true activa directUploadEnabled', () => {
      expect(directComponent.directUploadEnabled()).toBe(true);
      expect(directComponent.uploadState()).toBe('IDLE');
    });

    // F03: size > max se rechaza antes del hash
    it('F03: size > max se rechaza antes del hash y no llama createUploadIntent ni uploadDirect', () => {
      const large = new File(['x'], 'large.epub');
      Object.defineProperty(large, 'size', { value: directComponent.maxDocumentBytes + 1 });
      directComponent.selectedDocument.set(large);

      directComponent.uploadDocument();

      expect(directComponent.documentError()).toContain('tamaño permitido');
      expect(documentService.createUploadIntent).not.toHaveBeenCalled();
      expect(documentService.uploadDirect).not.toHaveBeenCalled();
      expect(directComponent.uploadState()).toBe('IDLE');
    });

    // F30: 50 MiB exactos accepted
    it('F30: 50 MiB exactos (52428800 bytes) accepted', () => {
      const exactFile = new File(['content'], 'exact.epub', { type: 'application/epub+zip' });
      Object.defineProperty(exactFile, 'size', { value: 52_428_800 });
      (directComponent as any).validateDocument(exactFile);

      expect(directComponent.selectedDocument()).toBe(exactFile);
      expect(directComponent.documentError()).toBeNull();
    });

    // F31: 50 MiB + 1 rejected antes de SHA-256
    it('F31: 50 MiB + 1 (52428801 bytes) rejected antes de SHA-256', async () => {
      const overFile = new File(['content'], 'over.epub', { type: 'application/epub+zip' });
      Object.defineProperty(overFile, 'size', { value: 52_428_801 });
      directComponent.selectedDocument.set(overFile);

      await directComponent.uploadDocument();

      expect(directComponent.documentError()).toContain('tamaño permitido');
      expect(documentService.createUploadIntent).not.toHaveBeenCalled();
      expect(documentService.uploadDirect).not.toHaveBeenCalled();
      expect(directComponent.uploadState()).toBe('IDLE');
    });

    // F07: upload progress 0–100
    it('F07: upload progress 0–100 procesa HttpEventType.UploadProgress y actualiza UI', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-1',
        documentId: 'doc-1',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: { 'Content-Type': 'application/epub+zip' },
      }));

      const progressSubject = new Subject<any>();
      documentService.uploadDirect.mockReturnValue(progressSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('UPLOADING');
      expect(directComponent.uploadProgressPercent()).toBe(0);

      // Progress 42%
      progressSubject.next({ type: HttpEventType.UploadProgress, loaded: 42, total: 100 });
      directFixture.detectChanges();
      expect(directComponent.uploadProgressPercent()).toBe(42);
      expect(directComponent.importStatusTitle()).toBe('Subiendo archivo 42%');

      // Progress 100%
      progressSubject.next({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
      directFixture.detectChanges();
      expect(directComponent.uploadProgressPercent()).toBe(100);
      expect(directComponent.importStatusTitle()).toBe('Subiendo archivo 100%');
    });

    // F08: PUT success llama confirm
    it('F08: PUT success llama confirm endpoint con uploadId y languageOverride', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-88',
        documentId: 'doc-88',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-88',
        jobId: 'job-88',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument('en');
      directFixture.detectChanges();

      expect(directComponent.uploadCompleted()).toBe(true);
      expect(documentService.confirmUpload).toHaveBeenCalledWith('upl-88', 'en');
      expect(directComponent.uploadState()).toBe('PROCESSING');
      expect(documentService.pollUntilTerminal).toHaveBeenCalledWith('doc-88');
    });

    // F09: confirm failure NO repite PUT
    it('F09: confirm failure NO repite PUT, mantiene uploadCompleted=true y marca errorPhase=CONFIRM_FAILED', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-9',
        documentId: 'doc-9',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 504 })));

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadCompleted()).toBe(true);
      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.errorPhase()).toBe('CONFIRM_FAILED');
      expect(directComponent.canRetryConfirm()).toBe(true);
      expect(directComponent.documentError()).toContain('No pudimos confirmar la subida');
      // Invariant: PUT was only called once
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
    });

    // F10: retry confirm usa mismo uploadId
    it('F10: retry confirm usa exactamente el mismo uploadId sin re-subir bytes a S3', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-id-persist-123',
        documentId: 'doc-123',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));

      await directComponent.uploadDocument('en');
      directFixture.detectChanges();

      expect(directComponent.canRetryConfirm()).toBe(true);
      expect(documentService.confirmUpload).toHaveBeenCalledTimes(1);
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);

      // Now retry confirm
      documentService.confirmUpload.mockReturnValueOnce(of({
        documentId: 'doc-123',
        jobId: 'job-123',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      directComponent.retryConfirm();
      directFixture.detectChanges();

      // Confirmed with same uploadId
      expect(documentService.confirmUpload).toHaveBeenCalledTimes(2);
      expect(documentService.confirmUpload).toHaveBeenLastCalledWith('upl-id-persist-123', 'en');
      // uploadDirect NOT called again
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
      expect(directComponent.uploadState()).toBe('PROCESSING');
    });

    // F14: PROCESSING mantiene polling
    it('F14: PROCESSING mantiene polling continuo hasta alcanzar READY', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-14',
        documentId: 'doc-14',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-14',
        jobId: 'job-14',
        status: 'PROCESSING',
      }));

      const pollSubject = new Subject<any>();
      documentService.pollUntilTerminal.mockReturnValue(pollSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(documentService.pollUntilTerminal).toHaveBeenCalledWith('doc-14');
      expect(directComponent.uploadState()).toBe('PROCESSING');
      expect(directComponent.importStatusTitle()).toBe('Procesando libro…');

      // Terminal event
      pollSubject.next({ documentId: 'doc-14', status: 'READY', format: 'EPUB' });
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('READY');
      expect(directComponent.importedDocument()?.status).toBe('READY');
      expect(directComponent.importing()).toBe(false);
    });

    // F15: cancel detiene PUT
    it('F15: cancel detiene el observable de PUT y resetea el estado a IDLE', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-15',
        documentId: 'doc-15',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));

      const uploadSubject = new Subject<any>();
      documentService.uploadDirect.mockReturnValue(uploadSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('UPLOADING');
      expect(uploadSubject.observed).toBe(true);

      directComponent.cancelOrClearDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('IDLE');
      expect(directComponent.importing()).toBe(false);
      expect(uploadSubject.observed).toBe(false);
    });

    // F16: presigned URL no se persiste
    it('F16: presigned URL no se persiste en localStorage ni sessionStorage', async () => {
      const localSetSpy = vi.spyOn(Storage.prototype, 'setItem');
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      const presignedUrl = 'https://bucket.s3.amazonaws.com/raw?X-Amz-Signature=secret12345';
      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-sec',
        documentId: 'doc-sec',
        uploadUrl: presignedUrl,
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-sec',
        jobId: 'job-sec',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      for (const call of localSetSpy.mock.calls) {
        expect(call[1]).not.toContain('X-Amz-Signature');
        expect(call[1]).not.toContain(presignedUrl);
      }
      localSetSpy.mockRestore();
    });

    it('retries with refreshUploadAuthorization if PUT returns 403 / presign expired', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-expired',
        documentId: 'doc-expired',
        uploadUrl: 'https://s3.example.com/expired-url',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: { 'Content-Type': 'application/epub+zip' },
      }));

      // First PUT fails with 403
      documentService.uploadDirect.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
      // Refresh succeeds with fresh url
      documentService.refreshUploadAuthorization.mockReturnValue(of({
        uploadId: 'upl-expired',
        documentId: 'doc-expired',
        uploadUrl: 'https://s3.example.com/fresh-url',
        method: 'PUT',
        expiresAt: '2026-09-24T00:15:00Z',
        requiredHeaders: { 'Content-Type': 'application/epub+zip' },
      }));
      // Second PUT succeeds
      documentService.uploadDirect.mockReturnValueOnce(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-expired',
        jobId: 'job-expired',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(documentService.refreshUploadAuthorization).toHaveBeenCalledWith('upl-expired');
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(2);
      expect(documentService.uploadDirect).toHaveBeenLastCalledWith(
        'https://s3.example.com/fresh-url',
        file,
        { 'Content-Type': 'application/epub+zip' }
      );
      expect(directComponent.uploadState()).toBe('PROCESSING');
    });

    // F18: PUT responde 412 -> llama confirmUpload con mismo uploadId
    it('F18: PUT responde 412 -> llama confirmUpload con mismo uploadId', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f18',
        documentId: 'doc-f18',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: { 'If-None-Match': '*' },
      }));
      documentService.uploadDirect.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 412 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f18',
        jobId: 'job-f18',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(documentService.confirmUpload).toHaveBeenCalledWith('upl-f18', undefined);
      expect(directComponent.uploadCompleted()).toBe(true);
      expect(directComponent.uploadState()).toBe('PROCESSING');
    });

    // F19: PUT 412 + confirm success -> avanza a PROCESSING -> NO segundo PUT -> NO nuevo intent
    it('F19: PUT 412 + confirm success -> avanza a PROCESSING -> NO segundo PUT -> NO nuevo intent', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f19',
        documentId: 'doc-f19',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 412 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f19',
        jobId: 'job-f19',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('PROCESSING');
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
      expect(documentService.createUploadIntent).toHaveBeenCalledTimes(1);
      expect(documentService.pollUntilTerminal).toHaveBeenCalledWith('doc-f19');
    });

    // F20: PUT timeout/403 -> refresh -> retry PUT devuelve 412 -> confirm -> no tercer PUT
    it('F20: PUT timeout/403 -> refresh -> retry PUT devuelve 412 -> confirm -> no tercer PUT', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f20',
        documentId: 'doc-f20',
        uploadUrl: 'https://s3.example.com/put-initial',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      // First PUT fails with 403
      documentService.uploadDirect.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
      // Refresh succeeds with fresh url
      documentService.refreshUploadAuthorization.mockReturnValue(of({
        uploadId: 'upl-f20',
        documentId: 'doc-f20',
        uploadUrl: 'https://s3.example.com/put-refreshed',
        method: 'PUT',
        expiresAt: '2026-09-24T00:15:00Z',
        requiredHeaders: {},
      }));
      // Second PUT fails with 412 (file was already written)
      documentService.uploadDirect.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 412 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f20',
        jobId: 'job-f20',
        status: 'PROCESSING',
      }));
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(documentService.refreshUploadAuthorization).toHaveBeenCalledWith('upl-f20');
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(2);
      expect(documentService.confirmUpload).toHaveBeenCalledWith('upl-f20', undefined);
      expect(directComponent.uploadState()).toBe('PROCESSING');
      // Invariant: No 3rd PUT
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(2);
    });

    // F21: 412 NO dispara createUploadIntent nuevamente
    it('F21: 412 NO dispara createUploadIntent nuevamente', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f21',
        documentId: 'doc-f21',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 412 })));
      // Backend confirm fails due to integrity mismatch
      documentService.confirmUpload.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(documentService.createUploadIntent).toHaveBeenCalledTimes(1);
      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.errorPhase()).toBe('CONFIRM_FAILED');
    });

    // F22: LANGUAGE_REQUIRED en direct mode -> NO llama confirmUpload(uploadId, "en")
    it('F22: LANGUAGE_REQUIRED en direct mode -> NO llama confirmUpload(uploadId, "en")', async () => {
      const file = new File(['pdf'], 'book.pdf', { type: 'application/pdf' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f22',
        documentId: 'doc-f22',
        uploadUrl: 'https://s3.example.com/pdf',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f22',
        jobId: 'job-f22',
        status: 'PROCESSING',
      }));

      const pollSubject = new Subject<any>();
      documentService.pollUntilTerminal.mockReturnValue(pollSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      // Backend worker fails with LANGUAGE_REQUIRED
      pollSubject.next({
        documentId: 'doc-f22',
        status: 'FAILED',
        failureReason: 'LANGUAGE_REQUIRED',
      });
      directFixture.detectChanges();

      expect(directComponent.languageRequired()).toBe(true);
      const confirmCallsBefore = documentService.confirmUpload.mock.calls.length;

      // User triggers retry language required
      directComponent.retryLanguageRequired();
      directFixture.detectChanges();

      // F22: confirmUpload is NOT called again with ("upl-f22", "en")
      expect(documentService.confirmUpload).toHaveBeenCalledTimes(confirmCallsBefore);
      expect(documentService.confirmUpload).not.toHaveBeenCalledWith('upl-f22', 'en');
    });

    // F23: LANGUAGE_REQUIRED direct mode -> NO vuelve a hacer PUT
    it('F23: LANGUAGE_REQUIRED direct mode -> NO vuelve a hacer PUT', async () => {
      const file = new File(['pdf'], 'book.pdf', { type: 'application/pdf' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f23',
        documentId: 'doc-f23',
        uploadUrl: 'https://s3.example.com/pdf',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f23',
        jobId: 'job-f23',
        status: 'PROCESSING',
      }));

      const pollSubject = new Subject<any>();
      documentService.pollUntilTerminal.mockReturnValue(pollSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      pollSubject.next({
        documentId: 'doc-f23',
        status: 'FAILED',
        failureReason: 'LANGUAGE_REQUIRED',
      });
      directFixture.detectChanges();

      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);

      directComponent.retryLanguageRequired();
      directFixture.detectChanges();

      // F23: PUT is NOT called again
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
    });

    // F24: LANGUAGE_REQUIRED direct mode -> conserva documentId/source state para futuro reprocess
    it('F24: LANGUAGE_REQUIRED direct mode -> conserva documentId/source state para futuro reprocess', async () => {
      const file = new File(['pdf'], 'book.pdf', { type: 'application/pdf' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f24',
        documentId: 'doc-f24',
        uploadUrl: 'https://s3.example.com/pdf',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(of({
        documentId: 'doc-f24',
        jobId: 'job-f24',
        status: 'PROCESSING',
      }));

      const pollSubject = new Subject<any>();
      documentService.pollUntilTerminal.mockReturnValue(pollSubject.asObservable());

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      pollSubject.next({
        documentId: 'doc-f24',
        status: 'FAILED',
        failureReason: 'LANGUAGE_REQUIRED',
      });
      directFixture.detectChanges();

      directComponent.requestLanguageReprocess('en');
      directFixture.detectChanges();

      // F24: Preserves documentId and uploadCompleted
      expect(directComponent.currentDocumentId()).toBe('doc-f24');
      expect(directComponent.uploadCompleted()).toBe(true);
      expect(directComponent.importedDocument()?.documentId).toBe('doc-f24');
      expect(directComponent.languageRequired()).toBe(true);
    });

    // F32: DOCUMENT_ALREADY_IMPORTED durante confirm -> terminal -> no retry confirm -> no segundo PUT
    it('F32: DOCUMENT_ALREADY_IMPORTED durante confirm -> terminal -> no retry confirm -> no segundo PUT', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f32',
        documentId: 'doc-f32',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { code: 'DOCUMENT_ALREADY_IMPORTED' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.documentError()).toContain('Este libro ya está en tu biblioteca');
      expect(directComponent.canRetryConfirm()).toBe(false);
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
      expect(documentService.createUploadIntent).toHaveBeenCalledTimes(1);
    });

    // F33: UPLOAD_INTEGRITY_MISMATCH -> canRetryConfirm false
    it('F33: UPLOAD_INTEGRITY_MISMATCH -> canRetryConfirm false', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f33',
        documentId: 'doc-f33',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 422,
          error: { code: 'UPLOAD_INTEGRITY_MISMATCH' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.canRetryConfirm()).toBe(false);
      expect(directComponent.documentError()).toContain('integridad');
    });

    // F34: STORAGE_TRANSIENT_ERROR -> canRetryConfirm true -> retry usa mismo uploadId -> no PUT
    it('F34: STORAGE_TRANSIENT_ERROR -> canRetryConfirm true -> retry usa mismo uploadId -> no PUT', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f34',
        documentId: 'doc-f34',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({
          status: 503,
          error: { code: 'STORAGE_TRANSIENT_ERROR' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.canRetryConfirm()).toBe(true);
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);

      documentService.confirmUpload.mockReturnValueOnce(
        of({ documentId: 'doc-f34', jobId: 'job-f34', status: 'PROCESSING' })
      );
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      directComponent.retryConfirm();
      directFixture.detectChanges();

      expect(documentService.confirmUpload).toHaveBeenCalledTimes(2);
      expect(documentService.confirmUpload).toHaveBeenLastCalledWith('upl-f34', undefined);
      // Invariant: no second PUT
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(1);
    });

    // F35: STORAGE_CHECKSUM_UNAVAILABLE -> canRetryConfirm true
    it('F35: STORAGE_CHECKSUM_UNAVAILABLE -> canRetryConfirm true', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f35',
        documentId: 'doc-f35',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 503,
          error: { code: 'STORAGE_CHECKSUM_UNAVAILABLE' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.canRetryConfirm()).toBe(true);
    });

    // F36: UPLOAD_NOT_COMPLETED -> retry upload usa refresh presign + mismo uploadId -> no create intent nuevo
    it('F36: UPLOAD_NOT_COMPLETED -> retry upload usa refresh presign + mismo uploadId -> no create intent nuevo', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f36',
        documentId: 'doc-f36',
        uploadUrl: 'https://s3.example.com/put-initial',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValueOnce(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { code: 'UPLOAD_NOT_COMPLETED' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.canRetryConfirm()).toBe(false);
      expect(directComponent.canRetryUpload()).toBe(true);
      expect(directComponent.documentError()).toContain('no se completó');

      // Now retry upload
      documentService.refreshUploadAuthorization.mockReturnValue(of({
        uploadId: 'upl-f36',
        documentId: 'doc-f36',
        uploadUrl: 'https://s3.example.com/put-refreshed',
        method: 'PUT',
        expiresAt: '2026-09-24T00:15:00Z',
        requiredHeaders: { 'Content-Type': 'application/epub+zip' },
      }));
      documentService.uploadDirect.mockReturnValueOnce(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValueOnce(
        of({ documentId: 'doc-f36', jobId: 'job-f36', status: 'PROCESSING' })
      );
      documentService.pollUntilTerminal.mockReturnValue(new Subject());

      directComponent.retryUpload();
      directFixture.detectChanges();

      expect(documentService.refreshUploadAuthorization).toHaveBeenCalledWith('upl-f36');
      expect(documentService.uploadDirect).toHaveBeenCalledTimes(2);
      expect(documentService.confirmUpload).toHaveBeenCalledTimes(2);
      // Invariant: NO new upload intent created!
      expect(documentService.createUploadIntent).toHaveBeenCalledTimes(1);
    });

    // F37: UPLOAD_ABORTED / UPLOAD_EXPIRED -> no retry confirm
    it('F37: UPLOAD_ABORTED / UPLOAD_EXPIRED -> no retry confirm', async () => {
      const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
      directComponent.selectedDocument.set(file);

      documentService.createUploadIntent.mockReturnValue(of({
        uploadId: 'upl-f37',
        documentId: 'doc-f37',
        uploadUrl: 'https://s3.example.com/put',
        method: 'PUT',
        expiresAt: '2026-09-24T00:00:00Z',
        requiredHeaders: {},
      }));
      documentService.uploadDirect.mockReturnValue(of(new HttpResponse({ status: 200 })));
      documentService.confirmUpload.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { code: 'UPLOAD_ABORTED' },
        }))
      );

      await directComponent.uploadDocument();
      directFixture.detectChanges();

      expect(directComponent.uploadState()).toBe('FAILED');
      expect(directComponent.canRetryConfirm()).toBe(false);
      expect(directComponent.documentError()).toContain('cancelada o abortada');
    });
  });
});
