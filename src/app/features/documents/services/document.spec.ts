import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { DocumentService } from './document';

describe('DocumentService', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers:[DocumentService,provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting(),{ provide:Auth,useValue:{ accessToken:() => 'jwt', logout: () => undefined } }] });
    service = TestBed.inject(DocumentService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each([
    ['book.epub', 'application/epub+zip'],
    ['book.pdf', 'application/pdf'],
  ])('uploads %s through the shared multipart endpoint', (fileName, mimeType) => {
    const file = new File(['document'], fileName, { type:mimeType });
    service.upload(file).subscribe((result) => expect(result.documentId).toBe('doc'));
    const request = http.expectOne('/api/v1/documents');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({ documentId:'doc',status:'PROCESSING' });
  });

  it('supports document status, list, structure and one unit', () => {
    service.getDocument('doc').subscribe(); http.expectOne('/api/v1/documents/doc').flush({});
    service.list(2, 8).subscribe();
    const list = http.expectOne((request) => request.url === '/api/v1/documents' && request.params.get('page') === '2' && request.params.get('size') === '8'); list.flush({});
    service.getStructure('doc').subscribe((structure) => {
      expect(structure.firstUnitId).toBe('unit-1');
      expect(structure.sections).toEqual([
        { id:'section-1',ordinal:1,title:'Chapter 1',firstUnitId:'unit-1',unitCount:2 },
        { id:'section-2',ordinal:2,title:null,firstUnitId:null,unitCount:0 },
      ]);
    });
    http.expectOne('/api/v1/documents/doc/structure').flush({ documentId:'doc',firstUnitId:'unit-1',sections:[
      { id:'section-1',ordinal:1,title:'Chapter 1',firstUnitId:'unit-1',unitCount:2 },
      { id:'section-2',ordinal:2,title:null,firstUnitId:null,unitCount:0 },
    ],totalUnits:2 });
    service.getUnit('doc','unit-1').subscribe(); http.expectOne('/api/v1/documents/doc/units/unit-1').flush({ tokens:[] });
  });

  it('maps REST vocabularyStatus to the shared ReaderToken status preserving null without forcing NEW', () => {
    let statuses: unknown[] = [];
    service.getUnit('doc', 'unit-1').subscribe((unit) => {
      statuses = unit.tokens.map((token) => token.status);
    });
    http.expectOne('/api/v1/documents/doc/units/unit-1').flush({
      documentId: 'doc',
      unitId: 'unit-1',
      tokens: [
        restToken('Unclassified', 'unclassified', null),
        restToken('New', 'new', 'NEW'),
        restToken('Learning', 'learning', 'LEARNING'),
        restToken('Known', 'known', 'KNOWN'),
        restToken('Ignored', 'ignored', 'IGNORED'),
      ],
    });
    expect(statuses).toEqual([null, 'NEW', 'LEARNING', 'KNOWN', 'IGNORED']);
  });

  it('gets and updates progress with expectedVersion', () => {
    service.getProgress('doc').subscribe(); http.expectOne('/api/v1/documents/doc/progress').flush({});
    service.updateProgress('doc',{ currentUnitId:'unit',completed:false,expectedVersion:2 }).subscribe();
    const request = http.expectOne('/api/v1/documents/doc/progress');
    expect(request.request.method).toBe('PUT'); expect(request.request.body).toEqual({ currentUnitId:'unit',completed:false,expectedVersion:2 }); request.flush({});
  });

  it('requests covers as authenticated Blobs', () => {
    service.getCover('doc').subscribe((blob) => expect(blob.type).toBe('image/jpeg'));
    const request = http.expectOne('/api/v1/documents/doc/cover');
    expect(request.request.responseType).toBe('blob'); expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush(new Blob(['cover'],{ type:'image/jpeg' }));
  });

  it('deletes a document through the authenticated endpoint without a body', () => {
    service.deleteDocument('doc').subscribe((result) => expect(result).toBeNull());

    const request = http.expectOne('/api/v1/documents/doc');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    expect(request.request.body).toBeNull();
    request.flush(null, { status:204,statusText:'No Content' });
  });

  it('polls while PROCESSING and stops at READY', async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    service.pollUntilTerminal('doc').subscribe((document) => statuses.push(document.status));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne('/api/v1/documents/doc').flush({ status:'PROCESSING' });
    await vi.advanceTimersByTimeAsync(1500);
    http.expectOne('/api/v1/documents/doc').flush({ status:'READY' });
    expect(statuses).toEqual(['PROCESSING','READY']);
    vi.useRealTimers();
  });

  it('stops polling when a document reaches FAILED', async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    service.pollUntilTerminal('doc').subscribe((document) => statuses.push(document.status));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne('/api/v1/documents/doc').flush({ status:'PROCESSING' });
    await vi.advanceTimersByTimeAsync(1500);
    http.expectOne('/api/v1/documents/doc').flush({ status:'FAILED',failureReason:'INVALID_PDF' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(statuses).toEqual(['PROCESSING','FAILED']);
    http.expectNone('/api/v1/documents/doc');
    vi.useRealTimers();
  });

  it('requests document vocabulary compatibility through the authenticated endpoint', () => {
    let result: unknown = null;
    service.getCompatibility('doc-123').subscribe((compatibility) => {
      result = compatibility;
    });

    const request = http.expectOne('/api/v1/documents/doc-123/compatibility');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');

    const mockResponse = {
      documentId: 'doc-123',
      uniqueWords: 2845,
      knownWords: 318,
      learningWords: 42,
      explicitNewWords: 8,
      ignoredWords: 15,
      unclassifiedWords: 2462,
      vocabularyFitPercentage: 82.5,
      classificationConfidencePercentage: 13.0,
    };
    request.flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });

  function restToken(value: string, normalizedValue: string, vocabularyStatus: string | null) {
    return { value, normalizedValue, type: 'WORD', vocabularyStatus };
  }
});
