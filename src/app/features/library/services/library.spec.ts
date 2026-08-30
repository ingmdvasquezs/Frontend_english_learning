import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { LibraryService } from './library';

describe('LibraryService', () => {
  let service: LibraryService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LibraryService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token' } },
      ],
    });
    service = TestBed.inject(LibraryService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests listUserReadings with the authenticated SOAP contract', () => {
    service.listUserReadings().subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:listUserReadingsRequest>');
    expect(request.request.body).toContain('<read:page>0</read:page>');
    expect(request.request.body).toContain('<read:size>20</read:size>');
    expect(request.request.body).not.toContain('<read:listUserReadingsRequest/>');
    expect(request.request.body.indexOf('<read:page>')).toBeLessThan(
      request.request.body.indexOf('<read:size>')
    );
    request.flush('<response/>');
  });

  it('parses pagination and one reading from the real response contract', () => {
    const response = `
      <read:listUserReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page>
        <read:size>20</read:size>
        <read:totalElements>1</read:totalElements>
        <read:readings>
          <read:readingId>reading-1</read:readingId>
          <read:title>A short story</read:title>
          <read:language>en</read:language>
          <read:createdAt>2026-08-29T12:00:00Z</read:createdAt>
          <read:uniqueWords>30</read:uniqueWords><read:knownWords>7</read:knownWords>
          <read:learningWords>2</read:learningWords><read:explicitNewWords>3</read:explicitNewWords>
          <read:ignoredWords>4</read:ignoredWords><read:unclassifiedWords>14</read:unclassifiedWords>
        </read:readings>
      </read:listUserReadingsResponse>`;

    expect(service.parseUserReadings(response)).toEqual({
      page: 0,
      size: 20,
      totalElements: 1,
      readings: [
        {
          readingId: 'reading-1',
          title: 'A short story',
          language: 'en',
          createdAt: '2026-08-29T12:00:00Z',
          uniqueWords: 30, knownWords: 7, learningWords: 2,
          explicitNewWords: 3, ignoredWords: 4, unclassifiedWords: 14,
          progressStatus: null,
        },
      ],
    });
  });

  it('parses an empty readings page', () => {
    const response = `
      <read:listUserReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page>
        <read:size>20</read:size>
        <read:totalElements>0</read:totalElements>
      </read:listUserReadingsResponse>`;

    expect(service.parseUserReadings(response)).toEqual({
      page: 0,
      size: 20,
      totalElements: 0,
      readings: [],
    });
  });

  it.each(['IN_PROGRESS', 'COMPLETED'] as const)('parses %s progress', (status) => {
    const response = `<read:listUserReadingsResponse xmlns:read="http://soap.com/english-reading/readings"><read:page>0</read:page><read:size>20</read:size><read:totalElements>1</read:totalElements><read:readings><read:readingId>r</read:readingId><read:title>T</read:title><read:language>en</read:language><read:progressStatus>${status}</read:progressStatus></read:readings></read:listUserReadingsResponse>`;
    expect(service.parseUserReadings(response).readings[0].progressStatus).toBe(status);
  });

  it('parses repeated readings and an optional missing createdAt', () => {
    const response = `
      <read:listUserReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>1</read:page>
        <read:size>2</read:size>
        <read:totalElements>4</read:totalElements>
        <read:readings>
          <read:readingId>reading-3</read:readingId>
          <read:title>Without date</read:title>
          <read:language>en</read:language>
        </read:readings>
        <read:readings>
          <read:readingId>reading-4</read:readingId>
          <read:title>With date</read:title>
          <read:language>en-US</read:language>
          <read:createdAt>2026-08-29T14:00:00Z</read:createdAt>
        </read:readings>
      </read:listUserReadingsResponse>`;

    expect(service.parseUserReadings(response)).toEqual({
      page: 1,
      size: 2,
      totalElements: 4,
      readings: [
        {
          readingId: 'reading-3',
          title: 'Without date',
          language: 'en',
          createdAt: null,
          uniqueWords: 0, knownWords: 0, learningWords: 0,
          explicitNewWords: 0, ignoredWords: 0, unclassifiedWords: 0,
          progressStatus: null,
        },
        {
          readingId: 'reading-4',
          title: 'With date',
          language: 'en-US',
          createdAt: '2026-08-29T14:00:00Z',
          uniqueWords: 0, knownWords: 0, learningWords: 0,
          explicitNewWords: 0, ignoredWords: 0, unclassifiedWords: 0,
          progressStatus: null,
        },
      ],
    });
  });

  it('registers escaped reading content in XSD sequence order', () => {
    service.registerReading('News & notes', '<English text>', 'en').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:registerReadingRequest>');
    expect(request.request.body).toContain('<read:title>News &amp; notes</read:title>');
    expect(request.request.body).toContain(
      '<read:content>&lt;English text&gt;</read:content>'
    );
    expect(request.request.body).toContain('<read:language>en</read:language>');
    const titleIndex = request.request.body.indexOf('<read:title>');
    const contentIndex = request.request.body.indexOf('<read:content>');
    const languageIndex = request.request.body.indexOf('<read:language>');
    expect(titleIndex).toBeLessThan(contentIndex);
    expect(contentIndex).toBeLessThan(languageIndex);
    request.flush('<response/>');
  });

  it('parses every required registerReading response field', () => {
    const response = `
      <read:registerReadingResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-5</read:readingId>
        <read:title>Registered title</read:title>
        <read:language>en</read:language>
        <read:createdAt>2026-08-29T15:00:00Z</read:createdAt>
      </read:registerReadingResponse>`;

    expect(service.parseRegisteredReadingResponse(response)).toEqual({
      readingId: 'reading-5',
      title: 'Registered title',
      language: 'en',
      createdAt: '2026-08-29T15:00:00Z',
    });
  });
});
