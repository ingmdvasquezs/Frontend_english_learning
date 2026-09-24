import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { DocumentService } from './document';
import { CreateDocumentUploadRequest, ConfirmDocumentUploadResponse } from '../models/document.models';

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

  it('F04: create intent body correcto with fileName, contentType, sizeBytes, checksumSha256 and JWT', () => {
    const payload = {
      fileName: 'book.epub',
      contentType: 'application/epub+zip',
      sizeBytes: 1024,
      checksumSha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    };
    service.createUploadIntent(payload).subscribe((res) => {
      expect(res.uploadId).toBe('upl-1');
      expect(res.documentId).toBe('doc-1');
      expect(res.uploadUrl).toBe('https://s3.example.com/upload-1');
    });

    const request = http.expectOne('/api/v1/documents/uploads');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({
      uploadId: 'upl-1',
      documentId: 'doc-1',
      uploadUrl: 'https://s3.example.com/upload-1',
      method: 'PUT',
      expiresAt: '2026-09-24T00:00:00Z',
      requiredHeaders: {
        'Content-Type': 'application/epub+zip',
        'x-amz-checksum-sha256': 'custom-checksum',
      },
    });
  });

  it('F05 & F06: S3 PUT no lleva Bearer (bypass JWT) y requiredHeaders exactos', () => {
    const file = new File(['dummy content'], 'book.epub', { type: 'application/epub+zip' });
    const requiredHeaders = {
      'Content-Type': 'application/epub+zip',
      'x-amz-checksum-sha256': 'custom-checksum',
    };

    service.uploadDirect('https://s3.amazonaws.com/bucket/key?signature=xyz', file, requiredHeaders).subscribe();

    const request = http.expectOne('https://s3.amazonaws.com/bucket/key?signature=xyz');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBe(file);
    // F05: S3 PUT no lleva Bearer
    expect(request.request.headers.has('Authorization')).toBe(false);
    // F06: requiredHeaders exactos
    expect(request.request.headers.get('Content-Type')).toBe('application/epub+zip');
    expect(request.request.headers.get('x-amz-checksum-sha256')).toBe('custom-checksum');
    request.flush(null, { status: 200, statusText: 'OK' });
  });

  it('confirms upload without multipart payload and passes languageOverride', () => {
    service.confirmUpload('upl-123', 'en').subscribe((res) => {
      expect(res.documentId).toBe('doc-1');
      expect(res.jobId).toBe('job-1');
      expect(res.status).toBe('PROCESSING');
    });

    const request = http.expectOne('/api/v1/documents/uploads/upl-123/confirm');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ languageOverride: 'en' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({ documentId: 'doc-1', jobId: 'job-1', status: 'PROCESSING', uploadStatus: 'CONFIRMED' });
  });

  it('F11: refresh presign usa mismo uploadId', () => {
    service.refreshUploadAuthorization('upl-123').subscribe((res) => {
      expect(res.uploadId).toBe('upl-123');
      expect(res.uploadUrl).toBe('https://s3.example.com/fresh-url');
    });

    const request = http.expectOne('/api/v1/documents/uploads/upl-123/presign');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({
      uploadId: 'upl-123',
      documentId: 'doc-1',
      uploadUrl: 'https://s3.example.com/fresh-url',
      method: 'PUT',
      expiresAt: '2026-09-24T00:15:00Z',
      requiredHeaders: { 'Content-Type': 'application/epub+zip' },
    });
  });

  it('F26: requiredHeaders soporta If-None-Match para write-once S3', () => {
    const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
    const requiredHeaders = {
      'Content-Type': 'application/epub+zip',
      'If-None-Match': '*',
    };

    service.uploadDirect('https://s3.amazonaws.com/bucket/key', file, requiredHeaders).subscribe();

    const request = http.expectOne('https://s3.amazonaws.com/bucket/key');
    expect(request.request.headers.get('If-None-Match')).toBe('*');
    expect(request.request.headers.get('Content-Type')).toBe('application/epub+zip');
    request.flush(null, { status: 200, statusText: 'OK' });
  });

  it('F27: frontend no intenta establecer Host / Authorization / Content-Length si vienen en requiredHeaders', () => {
    const file = new File(['content'], 'book.epub', { type: 'application/epub+zip' });
    const maliciousHeaders = {
      'Host': 'attacker.com',
      'Authorization': 'Bearer rogue-token',
      'Content-Length': '123456',
      'Content-Type': 'application/epub+zip',
    };

    service.uploadDirect('https://s3.amazonaws.com/bucket/key', file, maliciousHeaders).subscribe();

    const request = http.expectOne('https://s3.amazonaws.com/bucket/key');
    expect(request.request.headers.has('Host')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('Content-Length')).toBe(false);
    expect(request.request.headers.get('Content-Type')).toBe('application/epub+zip');
    request.flush(null, { status: 200, statusText: 'OK' });
  });

  it('F28: DTO create usa exactamente fileName/checksumSha256/method', () => {
    const payload: CreateDocumentUploadRequest = {
      fileName: 'odyssey.epub',
      contentType: 'application/epub+zip',
      sizeBytes: 2048,
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    let responseMethod = '';
    service.createUploadIntent(payload).subscribe((res) => {
      responseMethod = res.method;
      expect((res as any).httpMethod).toBeUndefined();
    });

    const request = http.expectOne('/api/v1/documents/uploads');
    expect(request.request.body).toEqual(payload);
    expect((request.request.body as any).filename).toBeUndefined();
    expect((request.request.body as any).sha256).toBeUndefined();

    request.flush({
      uploadId: 'upl-f28',
      documentId: 'doc-f28',
      uploadUrl: 'https://s3.example.com/put',
      method: 'PUT',
      expiresAt: '2026-09-24T00:00:00Z',
      requiredHeaders: { 'Content-Type': 'application/epub+zip' },
    });

    expect(responseMethod).toBe('PUT');
  });

  it('F29: DTO confirm verifica respuesta real (documentId, jobId, status, uploadStatus) sin requerir uploadId', () => {
    let confirmRes: ConfirmDocumentUploadResponse | undefined;
    service.confirmUpload('upl-f29', 'en').subscribe((res) => {
      confirmRes = res;
    });

    const request = http.expectOne('/api/v1/documents/uploads/upl-f29/confirm');
    expect(request.request.body).toEqual({ languageOverride: 'en' });
    expect((request.request.body as any).language).toBeUndefined();

    request.flush({
      documentId: 'doc-f29',
      jobId: 'job-f29',
      status: 'PROCESSING',
      uploadStatus: 'CONFIRMED',
    });

    expect(confirmRes?.documentId).toBe('doc-f29');
    expect(confirmRes?.jobId).toBe('job-f29');
    expect(confirmRes?.status).toBe('PROCESSING');
    expect(confirmRes?.uploadStatus).toBe('CONFIRMED');
    expect((confirmRes as any)?.uploadId).toBeUndefined();
    expect((confirmRes as any)?.importJobId).toBeUndefined();
  });

  function restToken(value: string, normalizedValue: string, vocabularyStatus: string | null) {
    return { value, normalizedValue, type: 'WORD', vocabularyStatus };
  }
});
