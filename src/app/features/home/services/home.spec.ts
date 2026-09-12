import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { HomeService } from './home';

describe('HomeService', () => {
  let service: HomeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HomeService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token', logout: () => undefined } },
      ],
    });
    service = TestBed.inject(HomeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends the authenticated recommendation request with page and size', () => {
    service.recommendPlatformReadings().subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain(
      '<read:recommendPlatformReadingsRequest>'
    );
    expect(request.request.body).toContain('<read:page>0</read:page>');
    expect(request.request.body).toContain('<read:size>12</read:size>');
    expect(request.request.body.indexOf('<read:page>')).toBeLessThan(
      request.request.body.indexOf('<read:size>')
    );
    expect(request.request.body).not.toContain('<read:userId>');
    request.flush('<response/>');
  });

  it('sends the authenticated continue-reading request with page and size', () => {
    service.listContinueReading(0, 10).subscribe();
    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:listContinueReadingRequest>');
    expect(request.request.body).toContain('<read:page>0</read:page>');
    expect(request.request.body).toContain('<read:size>10</read:size>');
    request.flush('<response/>');
  });

  it('parses USER and PLATFORM continue-reading items with nullable metadata', () => {
    const result = service.parseContinueReading(`
      <read:listContinueReadingResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page><read:size>10</read:size><read:totalElements>2</read:totalElements>
        <read:readings><read:readingId>user-1</read:readingId><read:title>My text</read:title><read:origin>USER</read:origin><read:progressStatus>IN_PROGRESS</read:progressStatus><read:startedAt>2026-09-04T10:00:00</read:startedAt></read:readings>
        <read:readings><read:readingId>platform-1</read:readingId><read:title>Platform story</read:title><read:origin>PLATFORM</read:origin><read:progressStatus>IN_PROGRESS</read:progressStatus><read:coverKey>platform-cover</read:coverKey><read:editorialLevel>A1</read:editorialLevel><read:category>Daily Life</read:category><read:startedAt>2026-09-04T09:00:00</read:startedAt></read:readings>
      </read:listContinueReadingResponse>`);
    expect(result).toEqual({
      page: 0, size: 10, totalElements: 2,
      readings: [
        { readingId:'user-1', title:'My text', origin:'USER', progressStatus:'IN_PROGRESS', coverKey:null, editorialLevel:null, category:null, startedAt:'2026-09-04T10:00:00' },
        { readingId:'platform-1', title:'Platform story', origin:'PLATFORM', progressStatus:'IN_PROGRESS', coverKey:'platform-cover', editorialLevel:'A1', category:'Daily Life', startedAt:'2026-09-04T09:00:00' },
      ],
    });
  });

  it('parses an empty recommendations page', () => {
    expect(service.parseRecommendations(pageXml(''))).toEqual({
      page: 0,
      size: 4,
      totalElements: 0,
      readings: [],
    });
  });

  it('parses one recommendation including decimal percentages', () => {
    const result = service.parseRecommendations(
      pageXml(readingXml('reading-1', true), 1)
    );

    expect(result.readings).toHaveLength(1);
    expect(result.readings[0]).toEqual({
      readingId: 'reading-1',
      title: 'A Morning at the Library',
      language: 'en',
      editorialLevel: 'A1',
      category: 'Daily Life',
      createdAt: '2026-08-29T12:00:00Z',
      uniqueWords: 23,
      knownWords: 12,
      learningWords: 2,
      explicitNewWords: 1,
      ignoredWords: 1,
      unclassifiedWords: 7,
      vocabularyFitPercentage: 90.25,
      classificationConfidencePercentage: 42.5,
      progressStatus: null,
      coverKey: null,
      reasonCode: null,
    });
  });

  it('parses multiple recommendations and optional createdAt', () => {
    const result = service.parseRecommendations(
      pageXml(
        `${readingXml('reading-1', true)}${readingXml('reading-2', false)}`,
        2
      )
    );

    expect(result.readings).toHaveLength(2);
    expect(result.readings[1].createdAt).toBeNull();
  });

  it('parses the C2 editorial level', () => {
    const result = service.parseRecommendations(
      pageXml(readingXml('reading-c2', true).replace('<read:editorialLevel>A1</read:editorialLevel>', '<read:editorialLevel>C2</read:editorialLevel>'), 1)
    );
    expect(result.readings[0].editorialLevel).toBe('C2');
  });

  it('parses optional coverKey when present and null when absent', () => {
    const withCover = service.parseRecommendations(pageXml(readingXml('covered', true).replace('</read:readings>', '<read:coverKey>the-camera-on-platform-three</read:coverKey></read:readings>'), 1));
    const withoutCover = service.parseRecommendations(pageXml(readingXml('plain', true), 1));
    expect(withCover.readings[0].coverKey).toBe('the-camera-on-platform-three');
    expect(withoutCover.readings[0].coverKey).toBeNull();
  });

  it('parses IN_PROGRESS, COMPLETED and absent progress', () => {
    const inProgress = service.parseRecommendations(pageXml(readingXml('one', true).replace('</read:readings>', '<read:progressStatus>IN_PROGRESS</read:progressStatus></read:readings>'), 1));
    const completed = service.parseRecommendations(pageXml(readingXml('two', true).replace('</read:readings>', '<read:progressStatus>COMPLETED</read:progressStatus></read:readings>'), 1));
    expect(inProgress.readings[0].progressStatus).toBe('IN_PROGRESS');
    expect(completed.readings[0].progressStatus).toBe('COMPLETED');
    expect(service.parseRecommendations(pageXml(readingXml('three', true), 1)).readings[0].progressStatus).toBeNull();
  });

  it('throws when a required recommendation field is missing', () => {
    const invalidReading = readingXml('reading-1', true).replace(
      '<read:title>A Morning at the Library</read:title>',
      ''
    );

    expect(() => service.parseRecommendations(pageXml(invalidReading, 1))).toThrow(
      'Invalid SOAP response: missing title'
    );
  });

  it('sends authenticated collection requests with the real contract fields', () => {
    service.listCollections().subscribe();
    let request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:listCollectionsRequest/>');
    request.flush('<response/>');

    service.listCollectionReadings('science-&-ideas', 2, 8).subscribe();
    request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:collectionKey>science-&amp;-ideas</read:collectionKey>');
    expect(request.request.body).toContain('<read:page>2</read:page>');
    expect(request.request.body).toContain('<read:size>8</read:size>');
    request.flush('<response/>');
  });

  it('parses and orders collection metadata by displayOrder', () => {
    const result = service.parseCollections(`
      <read:listCollectionsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:collections><read:key>second</read:key><read:displayName>Second</read:displayName><read:description>Two</read:description><read:displayOrder>2</read:displayOrder></read:collections>
        <read:collections><read:key>first</read:key><read:displayName>First</read:displayName><read:description>One</read:description><read:displayOrder>1</read:displayOrder><read:coverKey>first-cover</read:coverKey></read:collections>
      </read:listCollectionsResponse>`);
    expect(result.map((collection) => collection.key)).toEqual(['first', 'second']);
    expect(result[0].coverKey).toBe('first-cover');
    expect(result[1].coverKey).toBeNull();
  });

  it('parses collection readings with all personalized recommendation metrics', () => {
    const result = service.parseCollectionReadings(`
      <read:listCollectionReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page><read:size>8</read:size><read:totalElements>1</read:totalElements>
        <read:readings><read:readingId>collection-1</read:readingId><read:title>Collection Story</read:title><read:language>en</read:language><read:editorialLevel>B2</read:editorialLevel><read:category>Ideas</read:category><read:uniqueWords>200</read:uniqueWords><read:knownWords>156</read:knownWords><read:learningWords>14</read:learningWords><read:explicitNewWords>9</read:explicitNewWords><read:ignoredWords>7</read:ignoredWords><read:unclassifiedWords>14</read:unclassifiedWords><read:vocabularyFitPercentage>78</read:vocabularyFitPercentage><read:classificationConfidencePercentage>93.5</read:classificationConfidencePercentage><read:progressStatus>IN_PROGRESS</read:progressStatus><read:coverKey>collection-cover</read:coverKey></read:readings>
      </read:listCollectionReadingsResponse>`);
    expect(result.readings[0]).toEqual({
      readingId: 'collection-1', title: 'Collection Story', language: 'en',
      editorialLevel: 'B2', category: 'Ideas', createdAt: null,
      uniqueWords: 200, knownWords: 156, learningWords: 14,
      explicitNewWords: 9, ignoredWords: 7, unclassifiedWords: 14,
      vocabularyFitPercentage: 78, classificationConfidencePercentage: 93.5,
      progressStatus: 'IN_PROGRESS', coverKey: 'collection-cover',
      reasonCode: null,
    });
  });

  it('parses reasonCode when present and handles unknown codes gracefully', () => {
    const withReason = service.parseRecommendations(
      pageXml(
        readingXml('rec-reason', false).replace(
          '</read:readings>',
          '<read:reasonCode>HIGH_VOCABULARY_MATCH</read:reasonCode></read:readings>'
        ),
        1
      )
    );
    expect(withReason.readings[0].reasonCode).toBe('HIGH_VOCABULARY_MATCH');

    const withUnknownReason = service.parseRecommendations(
      pageXml(
        readingXml('rec-unknown', false).replace(
          '</read:readings>',
          '<read:reasonCode>NON_EXISTENT_CODE</read:reasonCode></read:readings>'
        ),
        1
      )
    );
    expect(withUnknownReason.readings[0].reasonCode).toBeNull();
  });

  function pageXml(readings: string, totalElements = 0): string {
    return `
      <read:recommendPlatformReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page>
        <read:size>4</read:size>
        <read:totalElements>${totalElements}</read:totalElements>
        ${readings}
      </read:recommendPlatformReadingsResponse>`;
  }

  function readingXml(readingId: string, includeCreatedAt: boolean): string {
    return `
      <read:readings>
        <read:readingId>${readingId}</read:readingId>
        <read:title>A Morning at the Library</read:title>
        <read:language>en</read:language>
        <read:editorialLevel>A1</read:editorialLevel>
        <read:category>Daily Life</read:category>
        ${includeCreatedAt ? '<read:createdAt>2026-08-29T12:00:00Z</read:createdAt>' : ''}
        <read:uniqueWords>23</read:uniqueWords>
        <read:knownWords>12</read:knownWords>
        <read:learningWords>2</read:learningWords>
        <read:explicitNewWords>1</read:explicitNewWords>
        <read:ignoredWords>1</read:ignoredWords>
        <read:unclassifiedWords>7</read:unclassifiedWords>
        <read:vocabularyFitPercentage>90.25</read:vocabularyFitPercentage>
        <read:classificationConfidencePercentage>42.50</read:classificationConfidencePercentage>
      </read:readings>`;
  }
});
