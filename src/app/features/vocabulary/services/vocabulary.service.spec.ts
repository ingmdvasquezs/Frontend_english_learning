import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VocabularyService } from './vocabulary.service';

describe('VocabularyService', () => {
  let service: VocabularyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VocabularyService],
    });
    service = TestBed.inject(VocabularyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('generates listUserVocabulary request without status or search when not provided', () => {
    service.listUserVocabulary(0, 20).subscribe();

    const req = httpMock.expectOne('/ws');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Content-Type')).toBe('text/xml');
    expect(req.request.body).toContain('<read:page>0</read:page>');
    expect(req.request.body).toContain('<read:size>20</read:size>');
    expect(req.request.body).not.toContain('<read:status>');
    expect(req.request.body).not.toContain('<read:search>');
  });

  it('generates listUserVocabulary request with status tag when valid status provided', () => {
    service.listUserVocabulary(1, 10, 'LEARNING').subscribe();

    const req = httpMock.expectOne('/ws');
    expect(req.request.body).toContain('<read:page>1</read:page>');
    expect(req.request.body).toContain('<read:size>10</read:size>');
    expect(req.request.body).toContain('<read:status>LEARNING</read:status>');
    expect(req.request.body).not.toContain('<read:search>');
  });

  it('generates listUserVocabulary request with escaped search tag when search term provided', () => {
    service.listUserVocabulary(0, 20, null, '  read & learn <fast>  ').subscribe();

    const req = httpMock.expectOne('/ws');
    expect(req.request.body).toContain(
      '<read:search>read &amp; learn &lt;fast&gt;</read:search>'
    );
    expect(req.request.body).not.toContain('<read:status>');
  });

  it('omits search tag if search is empty string or pure whitespace', () => {
    service.listUserVocabulary(0, 20, null, '   ').subscribe();

    const req = httpMock.expectOne('/ws');
    expect(req.request.body).not.toContain('<read:search>');
  });

  it('includes both status and search when both are provided', () => {
    service.listUserVocabulary(2, 15, 'KNOWN', 'book').subscribe();

    const req = httpMock.expectOne('/ws');
    expect(req.request.body).toContain('<read:page>2</read:page>');
    expect(req.request.body).toContain('<read:size>15</read:size>');
    expect(req.request.body).toContain('<read:status>KNOWN</read:status>');
    expect(req.request.body).toContain('<read:search>book</read:search>');
  });

  it('parses valid listUserVocabulary response with summary and entries', () => {
    const xml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <read:listUserVocabularyResponse xmlns:read="http://soap.com/english-reading/readings">
            <read:page>0</read:page>
            <read:size>20</read:size>
            <read:totalElements>2</read:totalElements>
            <read:summary>
              <read:totalCount>50</read:totalCount>
              <read:newCount>10</read:newCount>
              <read:learningCount>15</read:learningCount>
              <read:knownCount>20</read:knownCount>
              <read:ignoredCount>5</read:ignoredCount>
            </read:summary>
            <read:entries>
              <read:entryId>e-1</read:entryId>
              <read:wordId>w-1</read:wordId>
              <read:word>apple</read:word>
              <read:language>en</read:language>
              <read:status>KNOWN</read:status>
              <read:firstSeenAt>2026-09-01T10:00:00Z</read:firstSeenAt>
            </read:entries>
            <read:entries>
              <read:entryId>e-2</read:entryId>
              <read:wordId>w-2</read:wordId>
              <read:word>banana</read:word>
              <read:language>en</read:language>
              <read:status>LEARNING</read:status>
              <read:firstSeenAt>2026-09-02T12:00:00Z</read:firstSeenAt>
            </read:entries>
          </read:listUserVocabularyResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const result = service.parseUserVocabulary(xml);

    expect(result.page).toBe(0);
    expect(result.size).toBe(20);
    expect(result.totalElements).toBe(2);
    expect(result.summary).toEqual({
      totalCount: 50,
      newCount: 10,
      learningCount: 15,
      knownCount: 20,
      ignoredCount: 5,
    });
    expect(result.entries.length).toBe(2);
    expect(result.entries[0]).toEqual({
      entryId: 'e-1',
      wordId: 'w-1',
      word: 'apple',
      language: 'en',
      status: 'KNOWN',
      firstSeenAt: '2026-09-01T10:00:00Z',
    });
    expect(result.entries[1]).toEqual({
      entryId: 'e-2',
      wordId: 'w-2',
      word: 'banana',
      language: 'en',
      status: 'LEARNING',
      firstSeenAt: '2026-09-02T12:00:00Z',
    });
  });

  it('parses empty entries list gracefully', () => {
    const xml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <read:listUserVocabularyResponse xmlns:read="http://soap.com/english-reading/readings">
            <read:page>0</read:page>
            <read:size>20</read:size>
            <read:totalElements>0</read:totalElements>
            <read:summary>
              <read:totalCount>0</read:totalCount>
              <read:newCount>0</read:newCount>
              <read:learningCount>0</read:learningCount>
              <read:knownCount>0</read:knownCount>
              <read:ignoredCount>0</read:ignoredCount>
            </read:summary>
          </read:listUserVocabularyResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const result = service.parseUserVocabulary(xml);
    expect(result.page).toBe(0);
    expect(result.size).toBe(20);
    expect(result.totalElements).toBe(0);
    expect(result.summary.totalCount).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('throws error when SOAP Fault is received', () => {
    const xml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <soapenv:Fault>
            <faultcode>soapenv:Server</faultcode>
            <faultstring>Internal error occurred</faultstring>
          </soapenv:Fault>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    expect(() => service.parseUserVocabulary(xml)).toThrowError(
      'SOAP Fault: Internal error occurred'
    );
  });

  it('throws error when summary element is missing', () => {
    const xml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <read:listUserVocabularyResponse xmlns:read="http://soap.com/english-reading/readings">
            <read:page>0</read:page>
            <read:size>20</read:size>
            <read:totalElements>0</read:totalElements>
          </read:listUserVocabularyResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    expect(() => service.parseUserVocabulary(xml)).toThrowError(
      'Invalid SOAP response: missing summary'
    );
  });

  it('throws error when status in entry is invalid', () => {
    const xml = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <read:listUserVocabularyResponse xmlns:read="http://soap.com/english-reading/readings">
            <read:page>0</read:page>
            <read:size>20</read:size>
            <read:totalElements>1</read:totalElements>
            <read:summary>
              <read:totalCount>1</read:totalCount>
              <read:newCount>0</read:newCount>
              <read:learningCount>0</read:learningCount>
              <read:knownCount>0</read:knownCount>
              <read:ignoredCount>0</read:ignoredCount>
            </read:summary>
            <read:entries>
              <read:entryId>e-1</read:entryId>
              <read:wordId>w-1</read:wordId>
              <read:word>test</read:word>
              <read:language>en</read:language>
              <read:status>UNKNOWN_STATUS</read:status>
            </read:entries>
          </read:listUserVocabularyResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    expect(() => service.parseUserVocabulary(xml)).toThrowError(
      'Invalid SOAP response: invalid status "UNKNOWN_STATUS"'
    );
  });
});
