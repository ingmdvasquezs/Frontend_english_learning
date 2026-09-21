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
        { readingId:'user-1', title:'My text', origin:'USER', progressStatus:'IN_PROGRESS', coverKey:null, editorialLevel:null, category:null, startedAt:'2026-09-04T10:00:00', description:null, progressPercentage:null },
        { readingId:'platform-1', title:'Platform story', origin:'PLATFORM', progressStatus:'IN_PROGRESS', coverKey:'platform-cover', editorialLevel:'A1', category:'Daily Life', startedAt:'2026-09-04T09:00:00', description:null, progressPercentage:null },
      ],
    });
  });

  it('parses progressPercentage and shortDescription directly from backend SOAP response', () => {
    const result = service.parseContinueReading(`
      <read:listContinueReadingResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page><read:size>10</read:size><read:totalElements>1</read:totalElements>
        <read:readings>
          <read:readingId>candileja-1</read:readingId>
          <read:title>The Candileja</read:title>
          <read:origin>PLATFORM</read:origin>
          <read:progressStatus>IN_PROGRESS</read:progressStatus>
          <read:coverKey>candileja-llanos</read:coverKey>
          <read:editorialLevel>B1</read:editorialLevel>
          <read:category>Culture, Arts &amp; Fiction</read:category>
          <read:startedAt>2026-09-15T23:48:15.950494</read:startedAt>
          <read:shortDescription>An authentic description.</read:shortDescription>
          <read:progressPercentage>99</read:progressPercentage>
        </read:readings>
      </read:listContinueReadingResponse>`);
    expect(result.readings).toHaveLength(1);
    expect(result.readings[0].progressPercentage).toBe(99);
    expect(result.readings[0].description).toBe('An authentic description.');
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
      description: null,
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
      description: null,
    });
  });

  it('parses shortDescription from SOAP and maps it to description regardless of coverKey', () => {
    const xmlWithDescription = pageXml(
      readingXml('rec-desc', false).replace(
        '</read:readings>',
        '<read:shortDescription>A captivating tale of mountain spirits.</read:shortDescription></read:readings>'
      ),
      1
    );
    const result = service.parseRecommendations(xmlWithDescription);
    expect(result.readings[0].description).toBe('A captivating tale of mountain spirits.');

    // When shortDescription is omitted, description is null and does not fabricate text
    const xmlWithoutDescription = pageXml(readingXml('rec-no-desc', false), 1);
    const resultNoDesc = service.parseRecommendations(xmlWithoutDescription);
    expect(resultNoDesc.readings[0].description).toBeNull();
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

  it('sends the authenticated getDiscoveryRegionOverview request', () => {
    service.getDiscoveryRegionOverview('latin-america').subscribe();
    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getDiscoveryRegionOverviewRequest>');
    expect(request.request.body).toContain('<read:regionKey>latin-america</read:regionKey>');
    request.flush('<response/>');
  });

  it('parses getDiscoveryRegionOverview response with region, countries, hero images and topics', () => {
    const xml = `
      <read:getDiscoveryRegionOverviewResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:region>
          <read:key>latin-america</read:key>
          <read:displayName>Latinoamérica</read:displayName>
          <read:subtitle>Historias, cultura y lugares de nuestra región.</read:subtitle>
        </read:region>
        <read:countries>
          <read:countryCode>CO</read:countryCode>
          <read:displayName>Colombia</read:displayName>
          <read:tagline>Historias, lugares, mitos y tradiciones para aprender inglés leyendo.</read:tagline>
          <read:description>Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.</read:description>
          <read:displayOrder>1</read:displayOrder>
          <read:readingCount>15</read:readingCount>
          <read:heroImages>
            <read:assetKey>editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp</read:assetKey>
            <read:location>Villa de Leyva, Boyacá</read:location>
            <read:alt>Villa de Leyva, Boyacá</read:alt>
            <read:displayOrder>1</read:displayOrder>
          </read:heroImages>
          <read:heroImages>
            <read:assetKey>editorial/heroes/colombia/hero-colombia-valle-de-cocora.webp</read:assetKey>
            <read:location>Valle de Cocora, Quindío</read:location>
            <read:alt>Valle de Cocora, Quindío</read:alt>
            <read:displayOrder>2</read:displayOrder>
          </read:heroImages>
          <read:topics>
            <read:key>MYTHS_AND_LEGENDS</read:key>
            <read:displayName>Mitos y leyendas</read:displayName>
            <read:displayOrder>1</read:displayOrder>
            <read:readingCount>15</read:readingCount>
          </read:topics>
        </read:countries>
      </read:getDiscoveryRegionOverviewResponse>
    `;

    const overview = service.parseDiscoveryRegionOverview(xml);
    expect(overview.region.key).toBe('latin-america');
    expect(overview.region.displayName).toBe('Latinoamérica');
    expect(overview.region.subtitle).toBe('Historias, cultura y lugares de nuestra región.');

    expect(overview.countries).toHaveLength(1);
    const co = overview.countries[0];
    expect(co.countryCode).toBe('CO');
    expect(co.displayName).toBe('Colombia');
    expect(co.tagline).toBe('Historias, lugares, mitos y tradiciones para aprender inglés leyendo.');
    expect(co.description).toBe('Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.');
    expect(co.displayOrder).toBe(1);
    expect(co.readingCount).toBe(15);

    expect(co.heroImages).toHaveLength(2);
    expect(co.heroImages[0].assetKey).toBe('editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp');
    expect(co.heroImages[0].location).toBe('Villa de Leyva, Boyacá');
    expect(co.heroImages[1].assetKey).toBe('editorial/heroes/colombia/hero-colombia-valle-de-cocora.webp');

    expect(co.topics).toHaveLength(1);
    expect(co.topics[0].key).toBe('MYTHS_AND_LEGENDS');
    expect(co.topics[0].displayName).toBe('Mitos y leyendas');
    expect(co.topics[0].readingCount).toBe(15);
  });

  it('sends browsePlatformReadings request with countryCode and discoveryTopic filters', () => {
    service.browsePlatformReadings({
      countryCode: 'CO',
      discoveryTopic: 'MYTHS_AND_LEGENDS',
      page: 0,
      size: 20,
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:browsePlatformReadingsRequest>');
    expect(request.request.body).toContain('<read:countryCode>CO</read:countryCode>');
    expect(request.request.body).toContain('<read:discoveryTopic>MYTHS_AND_LEGENDS</read:discoveryTopic>');
    expect(request.request.body).toContain('<read:page>0</read:page>');
    expect(request.request.body).toContain('<read:size>20</read:size>');
    request.flush('<response/>');
  });

  it('parses browsePlatformReadings response including countryCode and discoveryTopic', () => {
    const xml = `
      <read:browsePlatformReadingsResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:page>0</read:page>
        <read:size>20</read:size>
        <read:totalElements>1</read:totalElements>
        <read:readings>
          <read:readingId>reading-dorado</read:readingId>
          <read:title>El Dorado</read:title>
          <read:language>en</read:language>
          <read:editorialLevel>B1</read:editorialLevel>
          <read:category>Culture, Arts &amp; Fiction</read:category>
          <read:uniqueWords>250</read:uniqueWords>
          <read:knownWords>100</read:knownWords>
          <read:learningWords>50</read:learningWords>
          <read:explicitNewWords>20</read:explicitNewWords>
          <read:ignoredWords>5</read:ignoredWords>
          <read:unclassifiedWords>75</read:unclassifiedWords>
          <read:vocabularyFitPercentage>88.5</read:vocabularyFitPercentage>
          <read:classificationConfidencePercentage>90.0</read:classificationConfidencePercentage>
          <read:coverKey>el-dorado-cover</read:coverKey>
          <read:countryCode>CO</read:countryCode>
          <read:discoveryTopic>MYTHS_AND_LEGENDS</read:discoveryTopic>
          <read:shortDescription>The legend of El Dorado.</read:shortDescription>
        </read:readings>
      </read:browsePlatformReadingsResponse>
    `;

    const page = service.parseBrowsePlatformReadings(xml);
    expect(page.page).toBe(0);
    expect(page.size).toBe(20);
    expect(page.totalElements).toBe(1);
    expect(page.readings).toHaveLength(1);
    expect(page.readings[0].title).toBe('El Dorado');
    expect(page.readings[0].countryCode).toBe('CO');
    expect(page.readings[0].discoveryTopic).toBe('MYTHS_AND_LEGENDS');
    expect(page.readings[0].description).toBe('The legend of El Dorado.');
    expect(page.readings[0].vocabularyFitPercentage).toBe(88.5);
  });

  it('sends browsePlatformReadings request with sort CREATED_AT_DESC', () => {
    service.browsePlatformReadings({
      sort: 'CREATED_AT_DESC',
      page: 0,
      size: 12,
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:sort>CREATED_AT_DESC</read:sort>');
    expect(request.request.body).toContain('<read:page>0</read:page>');
    expect(request.request.body).toContain('<read:size>12</read:size>');
    request.flush('<response/>');
  });

  it('sends getDiscoveryHome request with max limits', () => {
    service.getDiscoveryHome(10, 12, 8).subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getDiscoveryHomeRequest>');
    expect(request.request.body).toContain('<read:maxContinueReading>10</read:maxContinueReading>');
    expect(request.request.body).toContain('<read:maxForYou>12</read:maxForYou>');
    expect(request.request.body).toContain('<read:maxShelfReadings>8</read:maxShelfReadings>');
    request.flush('<response/>');
  });

  it('parses getDiscoveryHome response with continueReading, forYou, latinAmerica and shelves', () => {
    const xml = `
      <read:getDiscoveryHomeResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:continueReading>
          <read:readingId>cr-1</read:readingId>
          <read:title>Continue Reading 1</read:title>
          <read:origin>PLATFORM</read:origin>
          <read:progressStatus>IN_PROGRESS</read:progressStatus>
          <read:coverKey>cr-cover</read:coverKey>
          <read:editorialLevel>B1</read:editorialLevel>
          <read:category>Culture</read:category>
          <read:startedAt>2026-09-20T10:00:00</read:startedAt>
          <read:shortDescription>Short desc</read:shortDescription>
          <read:progressPercentage>45</read:progressPercentage>
        </read:continueReading>
        <read:forYou>
          <read:readingId>fy-1</read:readingId>
          <read:title>For You 1</read:title>
          <read:language>en</read:language>
          <read:editorialLevel>A2</read:editorialLevel>
          <read:category>Daily Life</read:category>
          <read:uniqueWords>120</read:uniqueWords>
          <read:knownWords>80</read:knownWords>
          <read:learningWords>10</read:learningWords>
          <read:explicitNewWords>5</read:explicitNewWords>
          <read:ignoredWords>2</read:ignoredWords>
          <read:unclassifiedWords>23</read:unclassifiedWords>
          <read:vocabularyFitPercentage>85</read:vocabularyFitPercentage>
          <read:classificationConfidencePercentage>90</read:classificationConfidencePercentage>
          <read:reasonCode>HIGH_VOCABULARY_MATCH</read:reasonCode>
        </read:forYou>
        <read:latinAmerica>
          <read:region>
            <read:key>latin-america</read:key>
            <read:displayName>Latinoamérica</read:displayName>
            <read:subtitle>Historias de nuestra región</read:subtitle>
          </read:region>
          <read:countries>
            <read:countryCode>CO</read:countryCode>
            <read:displayName>Colombia</read:displayName>
            <read:tagline>Tierra de historias</read:tagline>
            <read:description>Desc Colombia</read:description>
            <read:displayOrder>1</read:displayOrder>
            <read:readingCount>15</read:readingCount>
            <read:heroImages>
              <read:assetKey>cocora.webp</read:assetKey>
              <read:displayOrder>1</read:displayOrder>
            </read:heroImages>
            <read:topics>
              <read:key>MYTHS_AND_LEGENDS</read:key>
              <read:displayName>Mitos y leyendas</read:displayName>
              <read:displayOrder>1</read:displayOrder>
              <read:readingCount>15</read:readingCount>
            </read:topics>
          </read:countries>
          <read:defaultCountryCode>CO</read:defaultCountryCode>
          <read:defaultTopicKey>MYTHS_AND_LEGENDS</read:defaultTopicKey>
          <read:readings>
            <read:readingId>latam-1</read:readingId>
            <read:title>El Sombrerón</read:title>
            <read:language>en</read:language>
            <read:editorialLevel>B1</read:editorialLevel>
            <read:category>Culture</read:category>
            <read:uniqueWords>200</read:uniqueWords>
            <read:knownWords>140</read:knownWords>
            <read:learningWords>20</read:learningWords>
            <read:explicitNewWords>10</read:explicitNewWords>
            <read:ignoredWords>5</read:ignoredWords>
            <read:unclassifiedWords>25</read:unclassifiedWords>
            <read:vocabularyFitPercentage>80</read:vocabularyFitPercentage>
            <read:classificationConfidencePercentage>85</read:classificationConfidencePercentage>
            <read:countryCode>CO</read:countryCode>
            <read:discoveryTopic>MYTHS_AND_LEGENDS</read:discoveryTopic>
          </read:readings>
        </read:latinAmerica>
        <read:shelves>
          <read:key>nature-places</read:key>
          <read:title>Naturaleza y Lugares</read:title>
          <read:description>Explora el mundo natural</read:description>
          <read:displayOrder>1</read:displayOrder>
          <read:coverKey>nature-cover</read:coverKey>
          <read:type>GENERIC</read:type>
          <read:totalReadings>10</read:totalReadings>
          <read:readings>
            <read:readingId>nature-1</read:readingId>
            <read:title>Yellowstone</read:title>
            <read:language>en</read:language>
            <read:editorialLevel>B2</read:editorialLevel>
            <read:category>Nature</read:category>
            <read:uniqueWords>300</read:uniqueWords>
            <read:knownWords>220</read:knownWords>
            <read:learningWords>25</read:learningWords>
            <read:explicitNewWords>15</read:explicitNewWords>
            <read:ignoredWords>10</read:ignoredWords>
            <read:unclassifiedWords>30</read:unclassifiedWords>
            <read:vocabularyFitPercentage>75</read:vocabularyFitPercentage>
            <read:classificationConfidencePercentage>92</read:classificationConfidencePercentage>
          </read:readings>
        </read:shelves>
      </read:getDiscoveryHomeResponse>
    `;

    const result = service.parseDiscoveryHome(xml);
    expect(result.continueReading).toHaveLength(1);
    expect(result.continueReading[0].readingId).toBe('cr-1');
    expect(result.continueReading[0].progressPercentage).toBe(45);

    expect(result.forYou).toHaveLength(1);
    expect(result.forYou[0].readingId).toBe('fy-1');
    expect(result.forYou[0].reasonCode).toBe('HIGH_VOCABULARY_MATCH');

    expect(result.latinAmerica).not.toBeNull();
    expect(result.latinAmerica!.defaultCountryCode).toBe('CO');
    expect(result.latinAmerica!.defaultTopicKey).toBe('MYTHS_AND_LEGENDS');
    expect(result.latinAmerica!.region.displayName).toBe('Latinoamérica');
    expect(result.latinAmerica!.countries).toHaveLength(1);
    expect(result.latinAmerica!.countries[0].countryCode).toBe('CO');
    expect(result.latinAmerica!.readings).toHaveLength(1);
    expect(result.latinAmerica!.readings[0].readingId).toBe('latam-1');

    expect(result.shelves).toHaveLength(1);
    expect(result.shelves[0].key).toBe('nature-places');
    expect(result.shelves[0].title).toBe('Naturaleza y Lugares');
    expect(result.shelves[0].totalReadings).toBe(10);
    expect(result.shelves[0].readings).toHaveLength(1);
    expect(result.shelves[0].readings[0].title).toBe('Yellowstone');
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
