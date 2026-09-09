import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LibraryService } from '../../services/library';
import { NewReading } from './new-reading';
import { DocumentService } from '../../../documents/services/document';
import { HttpErrorResponse } from '@angular/common/http';

describe('NewReading', () => {
  let component: NewReading;
  let fixture: ComponentFixture<NewReading>;
  let service: {
    registerReading: ReturnType<typeof vi.fn>;
    parseRegisteredReadingResponse: ReturnType<typeof vi.fn>;
  };
  let router: Router;
  let documentService: { upload: ReturnType<typeof vi.fn>; pollUntilTerminal: ReturnType<typeof vi.fn> };

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
    documentService = { upload: vi.fn(), pollUntilTerminal: vi.fn() };

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
});
