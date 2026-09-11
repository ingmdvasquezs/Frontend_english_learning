import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { ReaderService } from './reader';

describe('ReaderService', () => {
  let service: ReaderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReaderService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token', logout: () => undefined } },
      ],
    });
    service = TestBed.inject(ReaderService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('generates an authenticated getReadingReaderData request without userId', () => {
    service.getReaderData('reading&1').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getReadingReaderDataRequest>');
    expect(request.request.body).toContain(
      '<read:readingId>reading&amp;1</read:readingId>'
    );
    expect(request.request.body).not.toContain('userId');
    request.flush('<response/>');
  });

  it('parses tokens in order preserving whitespace, punctuation and null status', () => {
    const result = service.parseReaderData(readerResponse());

    expect(result.readingId).toBe('reading-1');
    expect(result.progressStatus).toBe('IN_PROGRESS');
    expect(result.currentPartOrdinal).toBe(7);
    expect(result.paginationVersion).toBe(1);
    expect(result.tokens.map((token) => token.value).join('')).toBe(
      'Learning, learning!\nDone'
    );
    expect(result.tokens).toEqual([
      {
        value: 'Learning',
        normalizedValue: 'learning',
        type: 'WORD',
        status: null,
      },
      {
        value: ',',
        normalizedValue: null,
        type: 'PUNCTUATION',
        status: null,
      },
      {
        value: ' ',
        normalizedValue: null,
        type: 'WHITESPACE',
        status: null,
      },
      {
        value: 'learning',
        normalizedValue: 'learning',
        type: 'WORD',
        status: 'NEW',
      },
      {
        value: '!',
        normalizedValue: null,
        type: 'PUNCTUATION',
        status: null,
      },
      {
        value: '\n',
        normalizedValue: null,
        type: 'WHITESPACE',
        status: null,
      },
      {
        value: 'Done',
        normalizedValue: 'done',
        type: 'WORD',
        status: 'KNOWN',
      },
    ]);
  });

  it('parses absent and completed reader progress', () => {
    expect(service.parseReaderData(readerResponse().replace('<read:progressStatus>IN_PROGRESS</read:progressStatus>', '')).progressStatus).toBeNull();
    expect(service.parseReaderData(readerResponse().replace('IN_PROGRESS', 'COMPLETED')).progressStatus).toBe('COMPLETED');
  });

  it('maps legacy reader data without Part fields to null rather than zero', () => {
    const response = readerResponse()
      .replace('<read:currentPartOrdinal>7</read:currentPartOrdinal>', '')
      .replace('<read:paginationVersion>1</read:paginationVersion>', '');

    const result = service.parseReaderData(response);

    expect(result.currentPartOrdinal).toBeNull();
    expect(result.paginationVersion).toBeNull();
    expect(result.currentPartOrdinal).not.toBe(0);
    expect(result.paginationVersion).not.toBe(0);
  });

  it('serializes an authenticated updateReadingProgress with the required Part pair', () => {
    service.updateReadingProgress({
      readingId: 'reading&1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 7,
      paginationVersion: 1,
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    const body = request.request.body as string;
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(body).toContain('<read:updateReadingProgressRequest>');
    expect(body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(body).toContain('<read:progressStatus>IN_PROGRESS</read:progressStatus>');
    expect(body).toContain('<read:currentPartOrdinal>7</read:currentPartOrdinal>');
    expect(body).toContain('<read:paginationVersion>1</read:paginationVersion>');
    expect(body.indexOf('<read:currentPartOrdinal>')).toBeLessThan(
      body.indexOf('<read:paginationVersion>')
    );
    request.flush('<response/>');
  });

  it('turns an updateReadingProgress SOAP Fault into the existing observable error flow', () => {
    let failed = false;
    service.updateReadingProgress({
      readingId: 'reading-1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 2,
      paginationVersion: 1,
    }).subscribe({ error: () => (failed = true) });

    httpTesting.expectOne('/ws').flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body>
      </soapenv:Envelope>`);

    expect(failed).toBe(true);
  });

  it('sends authenticated completeReading XML and parses timestamps', () => {
    service.completeReading('reading&1').subscribe();
    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:completeReadingRequest>');
    expect(request.request.body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(request.request.body).not.toContain('userId');
    request.flush('<response/>');
    expect(service.parseCompleteReading(`<read:completeReadingResponse xmlns:read="http://soap.com/english-reading/readings"><read:readingId>reading-1</read:readingId><read:status>COMPLETED</read:status><read:startedAt>2026-08-30T10:00:00Z</read:startedAt><read:completedAt>2026-08-30T10:10:00Z</read:completedAt></read:completeReadingResponse>`)).toEqual({ readingId:'reading-1', status:'COMPLETED', startedAt:'2026-08-30T10:00:00Z', completedAt:'2026-08-30T10:10:00Z' });
  });

  it('turns a completeReading SOAP Fault into an observable error', () => {
    let failed = false;
    service.completeReading('reading-1').subscribe({ error: () => (failed = true) });
    httpTesting.expectOne('/ws').flush(`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`);
    expect(failed).toBe(true);
  });

  it.each(['LEARNING', 'KNOWN', 'IGNORED'] as const)(
    'parses explicit %s status',
    (status) => {
      const response = readerResponse().replace(
        '<read:status>KNOWN</read:status>',
        `<read:status>${status}</read:status>`
      );

      expect(service.parseReaderData(response).tokens.at(-1)?.status).toBe(
        status
      );
    }
  );

  it('generates one setVocabularyStatus request with escaped values and no userId', () => {
    service.setVocabularyStatus('Learning & Growth', 'en', 'LEARNING').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:setVocabularyStatusRequest>');
    expect(request.request.body).toContain(
      '<read:word>Learning &amp; Growth</read:word>'
    );
    expect(request.request.body).toContain('<read:language>en</read:language>');
    expect(request.request.body).toContain(
      '<read:status>LEARNING</read:status>'
    );
    expect(request.request.body).not.toContain('userId');
    expect(request.request.body.indexOf('<read:word>')).toBeLessThan(
      request.request.body.indexOf('<read:language>')
    );
    expect(request.request.body.indexOf('<read:language>')).toBeLessThan(
      request.request.body.indexOf('<read:status>')
    );
    request.flush('<response/>');
  });

  it('turns a SOAP Fault into an observable error', () => {
    let failed = false;
    service.setVocabularyStatus('word', 'en', 'KNOWN').subscribe({
      error: () => (failed = true),
    });
    const request = httpTesting.expectOne('/ws');
    request.flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body>
      </soapenv:Envelope>`);

    expect(failed).toBe(true);
  });

  function readerResponse(): string {
    return `
      <read:getReadingReaderDataResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-1</read:readingId>
        <read:title>Learning Story</read:title>
        <read:language>en</read:language>
        <read:progressStatus>IN_PROGRESS</read:progressStatus>
        <read:currentPartOrdinal>7</read:currentPartOrdinal>
        <read:paginationVersion>1</read:paginationVersion>
        <read:tokens><read:value>Learning</read:value><read:normalizedValue>learning</read:normalizedValue><read:type>WORD</read:type></read:tokens>
        <read:tokens><read:value>,</read:value><read:type>PUNCTUATION</read:type></read:tokens>
        <read:tokens><read:value> </read:value><read:type>WHITESPACE</read:type></read:tokens>
        <read:tokens><read:value>learning</read:value><read:normalizedValue>learning</read:normalizedValue><read:type>WORD</read:type><read:status>NEW</read:status></read:tokens>
        <read:tokens><read:value>!</read:value><read:type>PUNCTUATION</read:type></read:tokens>
        <read:tokens><read:value>\n</read:value><read:type>WHITESPACE</read:type></read:tokens>
        <read:tokens><read:value>Done</read:value><read:normalizedValue>done</read:normalizedValue><read:type>WORD</read:type><read:status>KNOWN</read:status></read:tokens>
      </read:getReadingReaderDataResponse>`;
  }
});
