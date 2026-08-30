import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { HomeService } from './home';

describe('HomeService', () => {
  let service: HomeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HomeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token' } },
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
    expect(request.request.body).toContain('<read:size>4</read:size>');
    expect(request.request.body.indexOf('<read:page>')).toBeLessThan(
      request.request.body.indexOf('<read:size>')
    );
    expect(request.request.body).not.toContain('<read:userId>');
    request.flush('<response/>');
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
