import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LibraryService, ReadingNotFoundSoapError } from '../../services/library';
import { Library } from './library';
import { userTextCoverUrl } from '../../../../shared/utils/user-text-cover';
import { DocumentService } from '../../../documents/services/document';
import { HttpErrorResponse } from '@angular/common/http';
import { ImportedDocument } from '../../../documents/models/document.models';

describe('Library', () => {
  let fixture: ComponentFixture<Library>;
  let response: Subject<string>;
  let service: {
    listUserReadings: ReturnType<typeof vi.fn>;
    parseUserReadings: ReturnType<typeof vi.fn>;
    deleteReading: ReturnType<typeof vi.fn>;
  };
  let documentService: { list: ReturnType<typeof vi.fn>; getCover: ReturnType<typeof vi.fn>; deleteDocument: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable:true, value:vi.fn(() => 'blob:cover') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable:true, value:vi.fn() });
    response = new Subject<string>();
    service = {
      listUserReadings: vi.fn(() => response.asObservable()),
      parseUserReadings: vi.fn(),
      deleteReading: vi.fn(),
    };
    documentService = {
      list: vi.fn(() => of({ content:[],page:0,size:20,totalElements:0 })),
      getCover: vi.fn(),
      deleteDocument: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Library],
      providers: [
        provideRouter([]),
        { provide: LibraryService, useValue: service },
        { provide: DocumentService, useValue: documentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Library);
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows loading while listUserReadings is pending', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando tus lecturas');
  });

  it('keeps the Add reading action linked to the existing creation route', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a[href="/library/new"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Añadir lectura');
  });

  it('shows readings returned by the backend', () => {
    service.parseUserReadings.mockReturnValue({
      page: 0,
      size: 20,
      totalElements: 1,
      readings: [
        {
          readingId: 'reading-1',
          title: 'A short story',
          language: 'en',
          createdAt: '2026-08-29',
          uniqueWords: 20, knownWords: 5, learningWords: 2,
          explicitNewWords: 1, ignoredWords: 3, unclassifiedWords: 9,
          vocabularyFitPercentage: 56,
          classificationConfidencePercentage: 80,
          progressStatus: 'IN_PROGRESS',
        },
      ],
    });
    fixture.detectChanges();
    response.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('A short story');
    expect(fixture.nativeElement.textContent).toContain('Compatibilidad 56%');
    expect(fixture.nativeElement.textContent).not.toContain('% de vocabulario conocido');
    expect(fixture.nativeElement.textContent).toContain('10 palabras por aprender');
    expect(fixture.nativeElement.textContent).toContain('En progreso');
    expect(fixture.nativeElement.textContent).toContain('Continuar');
    expect(fixture.nativeElement.textContent).toContain('LECTURA');
    expect(fixture.nativeElement.textContent).not.toContain('TEXT · LECTURA PERSONAL');
    expect(fixture.nativeElement.querySelector('.library-card-visual img')?.getAttribute('src')).toBe(userTextCoverUrl('reading-1'));
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T');
    expect(
      fixture.nativeElement.querySelector('.library-grid')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/reading-1"]')
    ).toBeTruthy();
  });

  it.each([
    [null, 'Sin empezar', 'Leer'],
    ['NOT_STARTED', 'Sin empezar', 'Leer'],
    ['IN_PROGRESS', 'En progreso', 'Continuar'],
    ['COMPLETED', 'Leída', 'Releer'],
  ] as const)('renders %s progress semantics', (progressStatus, status, cta) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'r',title:'Stateful',language:'en',createdAt:null,uniqueWords:0,knownWords:0,learningWords:0,explicitNewWords:0,ignoredWords:0,unclassifiedWords:0,progressStatus }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(status);
    expect(fixture.nativeElement.textContent).toContain(cta);
  });

  it('keeps detailed metrics in a desktop reveal without a fake progress bar or menu', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'r',title:'Metrics',language:'en',createdAt:null,uniqueWords:20,knownWords:5,learningWords:2,explicitNewWords:1,ignoredWords:3,unclassifiedWords:9,vocabularyFitPercentage:56,classificationConfidencePercentage:80,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.library-card') as HTMLElement;
    const reveal = card.querySelector('.library-card-metrics') as HTMLElement;
    expect(reveal.textContent).toContain('5 palabras conocidas');
    expect(reveal.textContent).toContain('2 palabras que estás aprendiendo');
    expect(reveal.textContent).toContain('10 palabras por aprender');
    expect(reveal.textContent).toContain('Compatibilidad 56%');
    expect(card.textContent).not.toContain('% de vocabulario conocido');
    expect(card.querySelector('[role="progressbar"]')).toBeFalsy();
    expect(card.querySelector('button')).toBeFalsy();
    expect(card.getAttribute('href')).toBe('/reading/r');
  });

  it.each([
    [0, 'Compatibilidad 0%'],
    [null, 'Compatibilidad no disponible'],
  ] as const)('renders TEXT vocabulary fit %s without falling back to known coverage', (vocabularyFitPercentage, expected) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{
      readingId:'fit',title:'Fit',language:'en',createdAt:null,
      uniqueWords:20,knownWords:1,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,
      vocabularyFitPercentage,classificationConfidencePercentage:null,progressStatus:null,
    }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.library-card') as HTMLElement;
    expect(card.querySelector('.library-card-summary')?.textContent).toContain(expected);
    expect(card.textContent).not.toContain('% de vocabulario conocido');
    expect(card.textContent).not.toContain('NaN');
    expect(card.querySelector('.library-card-metrics')?.textContent).toContain('1 palabra conocida');
    expect(card.querySelector('.library-card-metrics')?.textContent).toContain('0 palabras que estás aprendiendo');
    expect(card.querySelector('.library-card-metrics')?.textContent).toContain('1 palabra por aprender');
  });

  it('uses a safe fallback when the local cover fails', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'broken',title:'Broken cover',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('.library-card-visual img') as HTMLImageElement;

    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.library-card-visual img')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.library-cover-fallback')).toBeTruthy();
  });

  it('shows real USER counts and empty future categories without inventing content', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:7,readings:[{ readingId:'r',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.library-filters button')) as HTMLButtonElement[];

    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Todas (7)',
      'Mis lecturas (7)',
      'Libros / eBooks (0)',
      'PDFs (0)',
    ]);

    buttons[2].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.library-card')).toBeFalsy();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay contenido en esta categoría');

    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/reading/r"]')).toBeTruthy();
  });

  it('clamps long titles while preserving their full text and navigation', () => {
    const title = 'A deliberately very long title that must remain intact even when the card displays only two visual lines';
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'long',title,language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    fixture.detectChanges(); response.next('x'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.library-card-title').textContent).toBe(title);
    expect(fixture.nativeElement.querySelector('a[href="/reading/long"]')).toBeTruthy();
  });

  it('shows a clear empty state', () => {
    service.parseUserReadings.mockReturnValue({
      page: 0,
      size: 20,
      totalElements: 0,
      readings: [],
    });
    fixture.detectChanges();
    response.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Tu biblioteca está vacía'
    );
    expect(fixture.nativeElement.textContent).toContain('Añadir primera lectura');
    expect(fixture.nativeElement.querySelector('a[href="/library/new"]')).toBeTruthy();
  });

  it('combines TEXT and EPUB in Todas and separates the real filters', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'text',title:'My text',language:'en',createdAt:null,uniqueWords:2,knownWords:1,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{ documentId:'book',title:'My EPUB',author:'Author',language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:true,coverUrl:'/api/v1/documents/book/cover',progressStatus:'IN_PROGRESS',lastReadAt:null,createdAt:'2026-09-07' }] }));
    documentService.getCover.mockReturnValue(of(new Blob(['cover'])));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/reading/text"]')).toBeTruthy();
    const book = fixture.nativeElement.querySelector('a[href="/documents/book/read"]') as HTMLElement;
    expect(book.querySelector('.library-card-visual')?.classList.contains('document-cover')).toBe(true);
    expect(book.querySelector('img')?.getAttribute('src')).toBe('blob:cover');
    expect(book.textContent).toContain('My EPUB'); expect(book.textContent).toContain('Continuar');
    expect(book.textContent).not.toContain('vocabulario conocido');
    const filters = Array.from(fixture.nativeElement.querySelectorAll('.library-filters button')) as HTMLButtonElement[];
    filters[1].click(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('a[href="/documents/book/read"]')).toBeFalsy();
    filters[2].click(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('a[href="/documents/book/read"]')).toBeTruthy(); expect(fixture.nativeElement.querySelector('a[href="/reading/text"]')).toBeFalsy();
    filters[3].click(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Todavía no hay contenido');
    fixture.componentInstance.ngOnDestroy(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover');
  });

  it('renders PDF with the shared document card and isolates it in the PDFs filter', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:2,content:[
      { documentId:'epub',title:'EPUB book',author:'Writer',language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07' },
      { documentId:'pdf',title:'PDF book',author:'Author',language:'en',format:'PDF',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'IN_PROGRESS',lastReadAt:null,createdAt:'2026-09-08' },
    ] }));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"] .library-cover-fallback').textContent).toContain('PDF');
    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"]').textContent).toContain('DOCUMENTO · PDF');
    expect(Array.from(
      fixture.nativeElement.querySelectorAll('.document-card') as NodeListOf<HTMLElement>
    ).every((card) => !card.textContent?.includes('Compatibilidad'))).toBe(true);

    const filters = Array.from(fixture.nativeElement.querySelectorAll('.library-filters button')) as HTMLButtonElement[];
    expect(filters[2].textContent?.trim()).toBe('Libros / eBooks (1)');
    expect(filters[3].textContent?.trim()).toBe('PDFs (1)');
    filters[3].click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/documents/epub/read"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.document-card').textContent).toContain('DOCUMENTO · PDF');
    expect(fixture.nativeElement.querySelector('.document-card .library-cover-fallback').textContent).toContain('PDF');
    expect(fixture.nativeElement.querySelector('.document-card').textContent).not.toContain('Compatibilidad');
  });

  it.each([
    ['NOT_STARTED','Sin empezar','Leer'],
    ['IN_PROGRESS','En progreso','Continuar'],
    ['COMPLETED','Leído','Releer'],
  ] as const)('allows READY documents with %s progress to open the Reader', (progressStatus, statusLabel, cta) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{
      documentId:'ready',title:'Ready book',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,
      coverAvailable:false,coverUrl:null,progressStatus,lastReadAt:null,createdAt:'2026-09-07',
    }] }));

    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.document-card') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBe('/documents/ready/read');
    expect(card.textContent).toContain(statusLabel);
    expect(card.textContent).toContain(cta);
    expect(card.getAttribute('aria-disabled')).toBeNull();
  });

  it.each([
    ['PROCESSING','Procesando…'],
    ['FAILED','No disponible'],
  ] as const)('renders %s as an import state without a Reader link or reading CTA', (status, statusLabel) => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{
      documentId:'blocked',title:'Unavailable book',author:null,language:'en',format:'PDF',status,
      failureReason:status === 'FAILED' ? 'INVALID_PDF' : null,coverAvailable:false,coverUrl:null,
      progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07',
    }] }));

    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.document-card') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBeNull();
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.getAttribute('tabindex')).toBe('-1');
    expect(card.textContent).toContain(statusLabel);
    expect(card.textContent).not.toContain('Leer →');
    expect(card.textContent).not.toContain('Continuar →');
    expect(card.textContent).not.toContain('Sin empezar');
  });

  it('uses the EPUB editorial fallback when no cover is available', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{ documentId:'book',title:'No cover',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07' }] }));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    const documentCover = fixture.nativeElement.querySelector('.document-card .document-cover') as HTMLElement;
    expect(documentCover).toBeTruthy();
    expect(documentCover.querySelector('.library-cover-fallback')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Leer');
    expect(documentService.getCover).not.toHaveBeenCalled();
  });

  it('keeps TEXT covers horizontal while document covers use the book variant', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'text',title:'Horizontal text',language:'en',createdAt:null,uniqueWords:2,knownWords:1,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{ documentId:'book',title:'Vertical book',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07' }] }));

    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/reading/text"] .library-card-visual').classList.contains('document-cover')).toBe(false);
    expect(fixture.nativeElement.querySelector('a[href="/documents/book/read"] .library-card-visual').classList.contains('document-cover')).toBe(true);
  });

  it('falls back safely for a 404 cover response without breaking the EPUB card', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[{ documentId:'book',title:'Missing cover',author:'Writer',language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:true,coverUrl:'/api/v1/documents/book/cover',progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07' }] }));
    documentService.getCover.mockReturnValue(throwError(()=>new HttpErrorResponse({status:404})));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.document-card img')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.document-card .library-cover-fallback').textContent).toContain('Missing cover');
    expect(fixture.nativeElement.querySelector('a[href="/documents/book/read"]')).toBeTruthy();
  });

  it('revokes an object URL when its image fails and when a later cover replaces it', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    const page={ page:0,size:20,totalElements:1,content:[{ documentId:'book',title:'Covered',author:null,language:'en',format:'EPUB',status:'READY',failureReason:null,coverAvailable:true,coverUrl:'/api/v1/documents/book/cover',progressStatus:'NOT_STARTED',lastReadAt:null,createdAt:'2026-09-07' }] };
    documentService.list.mockReturnValue(of(page)); documentService.getCover.mockReturnValue(of(new Blob(['one'])));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    (fixture.nativeElement.querySelector('.document-card img') as HTMLImageElement).dispatchEvent(new Event('error')); fixture.detectChanges();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover');
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:second');
    fixture.componentInstance.loadDocuments();
    expect(fixture.componentInstance.documentCoverUrls()['book']).toBe('blob:second');
    fixture.componentInstance.loadDocuments();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second');
  });

  it('shows actions for owned TEXT and READY EPUB/PDF, but not PROCESSING documents', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:3,content:[
      importedDocument({ documentId:'epub',title:'Ready EPUB',format:'EPUB' }),
      importedDocument({ documentId:'pdf',title:'Ready PDF',format:'PDF' }),
      importedDocument({ documentId:'processing',title:'Processing PDF',format:'PDF',status:'PROCESSING' }),
    ] }));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    const actionButtons = fixture.nativeElement.querySelectorAll('.document-actions-trigger') as NodeListOf<HTMLButtonElement>;
    expect(actionButtons).toHaveLength(3);
    expect(Array.from(actionButtons).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Acciones para Personal','Acciones para Ready EPUB','Acciones para Ready PDF',
    ]);
    expect(fixture.nativeElement.querySelector('a[href="/reading/text"] .document-actions-trigger')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[aria-label="Acciones para Processing PDF"]')).toBeFalsy();
  });

  it('opens one contextual menu at a time and closes it by toggle, outside click or Escape', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[
      importedDocument({ documentId:'epub',title:'Ready EPUB' }),
    ] }));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    const textTrigger = fixture.nativeElement.querySelector('[aria-label="Acciones para Personal"]') as HTMLButtonElement;
    const documentTrigger = fixture.nativeElement.querySelector('[aria-label="Acciones para Ready EPUB"]') as HTMLButtonElement;
    expect(textTrigger.getAttribute('aria-haspopup')).toBe('menu');

    textTrigger.click(); fixture.detectChanges();
    expect(textTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('[role="menu"]')).toHaveLength(1);

    const otherCard = fixture.nativeElement.querySelector('a[href="/documents/epub/read"]') as HTMLAnchorElement;
    otherCard.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();

    textTrigger.click(); fixture.detectChanges();
    documentTrigger.click(); fixture.detectChanges();
    expect(textTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(documentTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('[role="menu"]')).toHaveLength(1);

    documentTrigger.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();

    textTrigger.click(); fixture.detectChanges();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();

    textTrigger.click(); fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape',bubbles:true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
    expect(document.activeElement).toBe(textTrigger);
  });

  it('renders a transparent square hit area whose wrapper contains only trigger and dropdown', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.library-card-shell') as HTMLElement;
    const wrapper = card.querySelector('.library-actions') as HTMLElement;
    const trigger = wrapper.querySelector('.document-actions-trigger') as HTMLButtonElement;
    const styles = getComputedStyle(trigger);

    expect(wrapper.contains(card.querySelector('.library-card'))).toBe(false);
    expect(wrapper.children).toHaveLength(1);
    expect(styles.backgroundColor === 'transparent' || styles.backgroundColor === 'rgba(0, 0, 0, 0)').toBe(true);
    expect(styles.borderTopWidth).toBe('0px');
    expect(styles.borderRadius).toBe('0px');
    expect(styles.boxShadow).toBe('none');

    trigger.click(); fixture.detectChanges();
    expect(wrapper.children).toHaveLength(2);
    expect(wrapper.querySelector('[role="menu"]')).toBeTruthy();
  });

  it('closes the menu for real DOM pointer events on the header and whenever a filter changes', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('[aria-label="Acciones para Personal"]') as HTMLButtonElement;
    const header = fixture.nativeElement.querySelector('.library-header') as HTMLElement;
    const filters = fixture.nativeElement.querySelectorAll('.library-filters button') as NodeListOf<HTMLButtonElement>;

    trigger.click(); fixture.detectChanges();
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();

    trigger.click(); fixture.detectChanges();
    filters[1].click(); fixture.detectChanges();
    expect(fixture.componentInstance.activeFilter()).toBe('personal');
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();

    filters[0].click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
  });

  it('cleans up the capture listener and transient menu state when Library is destroyed', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener');
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Acciones para Personal"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.openActionMenuKey()).toBe('reading:text');

    fixture.destroy();
    expect(removeListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(fixture.componentInstance.openActionMenuKey()).toBeNull();
    expect(fixture.componentInstance.deletionTarget()).toBeNull();

    const recreated = TestBed.createComponent(Library);
    expect(recreated.componentInstance.openActionMenuKey()).toBeNull();
    recreated.destroy();
  });

  it('opens a title-specific confirmation and cancel does not delete', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[importedDocument({ title:'As You Like It' })] }));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    (fixture.nativeElement.querySelector('.document-actions-trigger') as HTMLButtonElement).click(); fixture.detectChanges();
    (fixture.nativeElement.querySelector('.document-actions-menu button') as HTMLButtonElement).click(); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('#document-delete-title').textContent).toContain('As You Like It');
    expect(fixture.nativeElement.textContent).toContain('permanecerán en tu vocabulario');
    (fixture.nativeElement.querySelector('.document-delete-cancel') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(documentService.deleteDocument).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
  });

  it('deletes an owned TEXT reading through SOAP without touching REST documents or Blob covers', () => {
    const deletion = new Subject<{ success:boolean }>();
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:2,readings:[
      { readingId:'delete-text',title:'Delete text',language:'en',createdAt:null,uniqueWords:1,knownWords:1,learningWords:0,explicitNewWords:0,ignoredWords:0,unclassifiedWords:0,progressStatus:'IN_PROGRESS' },
      { readingId:'keep-text',title:'Keep text',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:2,content:[
      importedDocument({ documentId:'epub',format:'EPUB',coverAvailable:true }),
      importedDocument({ documentId:'pdf',format:'PDF' }),
    ] }));
    documentService.getCover.mockReturnValue(of(new Blob(['cover'])));
    service.deleteReading.mockReturnValue(deletion);
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    const reading = fixture.componentInstance.readings().find((item) => item.readingId === 'delete-text')!;
    fixture.componentInstance.requestReadingDeletion(reading);
    fixture.componentInstance.confirmDeletion();
    fixture.componentInstance.confirmDeletion();

    expect(service.deleteReading).toHaveBeenCalledOnce();
    expect(service.deleteReading).toHaveBeenCalledWith('delete-text');
    expect(documentService.deleteDocument).not.toHaveBeenCalled();
    expect(fixture.componentInstance.deletingTargetKeys().has('reading:delete-text')).toBe(true);
    deletion.next({ success:true }); deletion.complete(); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/reading/delete-text"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('a[href="/reading/keep-text"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/documents/epub/read"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"]')).toBeTruthy();
    expect(fixture.componentInstance.readingCount()).toBe(1);
    expect(fixture.componentInstance.documentCount()).toBe(2);
    expect(fixture.componentInstance.allCount()).toBe(3);
    expect(fixture.componentInstance.ebookCount()).toBe(1);
    expect(fixture.componentInstance.pdfCount()).toBe(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('uses the shared confirmation for TEXT and cancel does not call either transport', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'text',title:'My own text',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Acciones para My own text"]') as HTMLButtonElement).click(); fixture.detectChanges();
    (fixture.nativeElement.querySelector('.document-actions-menu button') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#document-delete-title').textContent).toContain('My own text');
    expect(fixture.nativeElement.textContent).toContain('Se eliminará esta lectura y perderás su progreso.');
    (fixture.nativeElement.querySelector('.document-delete-cancel') as HTMLButtonElement).click(); fixture.detectChanges();

    expect(service.deleteReading).not.toHaveBeenCalled();
    expect(documentService.deleteDocument).not.toHaveBeenCalled();
  });

  it('treats reading NOT_FOUND as deleted, while a general SOAP error keeps the card retryable', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[
      { readingId:'stale',title:'Stale text',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null },
    ] });
    service.deleteReading
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(throwError(() => new ReadingNotFoundSoapError()));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    fixture.componentInstance.requestReadingDeletion(fixture.componentInstance.readings()[0]);

    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/reading/stale"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('No pudimos eliminar la lectura');
    expect(fixture.componentInstance.deletingTargetKeys().has('reading:stale')).toBe(false);

    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();
    expect(service.deleteReading).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('a[href="/reading/stale"]')).toBeFalsy();
    expect(fixture.componentInstance.readingCount()).toBe(0);
  });

  it('deletes once after confirmation, updates counters and revokes only its Blob URL', () => {
    const deletion = new Subject<void>();
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:1,readings:[{ readingId:'text',title:'Personal',language:'en',createdAt:null,uniqueWords:1,knownWords:0,learningWords:0,explicitNewWords:1,ignoredWords:0,unclassifiedWords:0,progressStatus:null }] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:2,content:[
      importedDocument({ documentId:'pdf',title:'Delete PDF',format:'PDF',coverAvailable:true }),
      importedDocument({ documentId:'epub',title:'Keep EPUB',format:'EPUB' }),
    ] }));
    documentService.getCover.mockReturnValue(of(new Blob(['cover'])));
    documentService.deleteDocument.mockReturnValue(deletion);
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    const pdf = fixture.componentInstance.documents().find((document) => document.documentId === 'pdf')!;
    fixture.componentInstance.requestDocumentDeletion(pdf);
    fixture.componentInstance.confirmDeletion();
    fixture.componentInstance.confirmDeletion();

    expect(documentService.deleteDocument).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.deletingDocumentIds().has('pdf')).toBe(true);
    deletion.next(); deletion.complete(); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/documents/pdf/read"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('a[href="/documents/epub/read"]')).toBeTruthy();
    expect(fixture.componentInstance.documentCount()).toBe(1);
    expect(fixture.componentInstance.allCount()).toBe(2);
    expect(fixture.componentInstance.pdfCount()).toBe(0);
    expect(fixture.componentInstance.ebookCount()).toBe(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover');
  });

  it('keeps the card and allows retry after DOCUMENT_PROCESSING or a network error', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[importedDocument({ documentId:'race' })] }));
    documentService.deleteDocument
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status:409,error:{ code:'DOCUMENT_PROCESSING' } })))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status:0 })))
      .mockReturnValueOnce(of(void 0));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    fixture.componentInstance.requestDocumentDeletion(fixture.componentInstance.documents()[0]);

    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('todavía se está procesando');
    expect(fixture.nativeElement.querySelector('a[href="/documents/race/read"]')).toBeTruthy();
    expect(fixture.componentInstance.deletingDocumentIds().has('race')).toBe(false);

    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos eliminar el documento');
    expect(fixture.nativeElement.querySelector('a[href="/documents/race/read"]')).toBeTruthy();

    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();
    expect(documentService.deleteDocument).toHaveBeenCalledTimes(3);
    expect(fixture.nativeElement.querySelector('a[href="/documents/race/read"]')).toBeFalsy();
  });

  it('treats DOCUMENT_NOT_FOUND as the desired local outcome', () => {
    service.parseUserReadings.mockReturnValue({ page:0,size:20,totalElements:0,readings:[] });
    documentService.list.mockReturnValue(of({ page:0,size:20,totalElements:1,content:[importedDocument({ documentId:'gone' })] }));
    documentService.deleteDocument.mockReturnValue(throwError(() => new HttpErrorResponse({ status:404,error:{ code:'DOCUMENT_NOT_FOUND' } })));
    fixture.detectChanges(); response.next('text'); fixture.detectChanges();
    fixture.componentInstance.requestDocumentDeletion(fixture.componentInstance.documents()[0]);
    fixture.componentInstance.confirmDeletion(); fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/documents/gone/read"]')).toBeFalsy();
    expect(fixture.componentInstance.documentCount()).toBe(0);
    expect(fixture.componentInstance.deleteError()).toBeNull();
  });

  it('shows an error when listUserReadings fails', () => {
    fixture.detectChanges();
    response.error(new Error('SOAP error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar tus lecturas'
    );
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });

  function importedDocument(overrides: Partial<ImportedDocument> = {}): ImportedDocument {
    return {
      documentId:'document',title:'Document',author:null,language:'en',format:'EPUB',status:'READY',
      failureReason:null,coverAvailable:false,coverUrl:null,progressStatus:'NOT_STARTED',lastReadAt:null,
      createdAt:'2026-09-07',...overrides,
    };
  }
});
