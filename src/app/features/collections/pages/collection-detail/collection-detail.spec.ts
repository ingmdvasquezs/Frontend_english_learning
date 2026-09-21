import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { CollectionDetail, NEUTRAL_LATAM_HERO_FALLBACK } from './collection-detail';
import { HomeService } from '../../../home/services/home';
import {
  BrowsePlatformReadingsPage,
  DiscoveryRegionOverview,
  ReadingCollection,
  RecommendedPlatformReading,
} from '../../../home/models/home.models';

describe('CollectionDetail', () => {
  let component: CollectionDetail;
  let fixture: ComponentFixture<CollectionDetail>;
  let homeServiceMock: {
    getDiscoveryRegionOverview: ReturnType<typeof vi.fn>;
    parseDiscoveryRegionOverview: ReturnType<typeof vi.fn>;
    listCollections: ReturnType<typeof vi.fn>;
    parseCollections: ReturnType<typeof vi.fn>;
    browsePlatformReadings: ReturnType<typeof vi.fn>;
    parseBrowsePlatformReadings: ReturnType<typeof vi.fn>;
  };
  let paramMapSubject: BehaviorSubject<ParamMap>;
  let queryParamMapSubject: BehaviorSubject<ParamMap>;

  const mockRegionOverview: DiscoveryRegionOverview = {
    region: {
      key: 'latin-america',
      displayName: 'Latinoamérica',
      subtitle: 'Historias, cultura y lugares de nuestra región.',
    },
    countries: [
      {
        countryCode: 'CO',
        displayName: 'Colombia',
        tagline: 'Tierra de realismo mágico',
        description: 'Historias de la memoria oral colombiana',
        displayOrder: 1,
        readingCount: 15,
        heroImages: [
          {
            assetKey: 'editorial/heroes/hero-latam-colombia-valle-de-cocora.webp',
            location: 'Valle de Cocora',
            alt: 'Cocora',
            displayOrder: 1,
          },
        ],
        topics: [
          {
            key: 'MYTHS_AND_LEGENDS',
            displayName: 'Mitos y leyendas',
            displayOrder: 1,
            readingCount: 10,
          },
          {
            key: 'REAL_STORIES',
            displayName: 'Historias reales',
            displayOrder: 2,
            readingCount: 5,
          },
        ],
      },
      {
        countryCode: 'MX',
        displayName: 'México',
        tagline: 'Cultura milenaria',
        description: 'Relatos de tradiciones mexicanas',
        displayOrder: 2,
        readingCount: 8,
        heroImages: [
          {
            assetKey: 'editorial/heroes/hero-mexico.webp',
            location: 'Chichen Itza',
            alt: 'Chichen Itza',
            displayOrder: 1,
          },
        ],
        topics: [
          {
            key: 'HISTORY_AND_MEMORY',
            displayName: 'Historia y memoria',
            displayOrder: 1,
            readingCount: 8,
          },
        ],
      },
      {
        countryCode: 'PE',
        displayName: 'Perú',
        tagline: 'Cuna de los Andes',
        description: 'Historias andinas',
        displayOrder: 3,
        readingCount: 6,
        heroImages: [],
        topics: [
          {
            key: 'ANDES_CULTURE',
            displayName: 'Cultura andina',
            displayOrder: 1,
            readingCount: 6,
          },
        ],
      },
    ],
  };

  const mockCollections: ReadingCollection[] = [
    {
      key: 'colombian-myths-legends',
      displayName: 'Mitos y leyendas de Colombia',
      description: 'Relatos de la memoria oral',
      displayOrder: 1,
      coverKey: 'colombian-myths-legends',
      readingCount: 15,
    },
  ];

  const mockReading: RecommendedPlatformReading = {
    readingId: 'reading-1',
    title: 'The Silbón',
    language: 'en',
    editorialLevel: 'B1',
    category: 'CULTURE_ARTS_AND_FICTION',
    createdAt: '2026-09-17T00:00:00Z',
    uniqueWords: 200,
    knownWords: 150,
    learningWords: 20,
    explicitNewWords: 30,
    ignoredWords: 0,
    unclassifiedWords: 0,
    vocabularyFitPercentage: 85,
    classificationConfidencePercentage: 90,
    progressStatus: null,
    coverKey: 'the-silbon',
    reasonCode: null,
    description: 'A dark legend of the plains.',
  };

  const mockBrowsePage: BrowsePlatformReadingsPage = {
    page: 0,
    size: 12,
    totalElements: 1,
    readings: [mockReading],
  };

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject<ParamMap>(
      convertToParamMap({ slug: 'latin-america' })
    );
    queryParamMapSubject = new BehaviorSubject<ParamMap>(
      convertToParamMap({})
    );

    homeServiceMock = {
      getDiscoveryRegionOverview: vi.fn().mockReturnValue(of('<regionXml/>')),
      parseDiscoveryRegionOverview: vi.fn().mockReturnValue(mockRegionOverview),
      listCollections: vi.fn().mockReturnValue(of('<collectionsXml/>')),
      parseCollections: vi.fn().mockReturnValue(mockCollections),
      browsePlatformReadings: vi.fn().mockReturnValue(of('<browseXml/>')),
      parseBrowsePlatformReadings: vi.fn().mockReturnValue(mockBrowsePage),
    };

    await TestBed.configureTestingModule({
      imports: [CollectionDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
            queryParamMap: queryParamMapSubject.asObservable(),
          },
        },
        { provide: HomeService, useValue: homeServiceMock },
      ],
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(CollectionDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('B & C: Initial Latin America performs exactly 1 metadata call and 1 browse call with valid country and topic, and no browse occurs before metadata', () => {
    let metadataResolved = false;
    let browseCalledBeforeMetadata = false;

    homeServiceMock.getDiscoveryRegionOverview.mockImplementation(() => {
      return of('<regionXml/>').pipe((source) => {
        metadataResolved = true;
        return source;
      });
    });

    homeServiceMock.browsePlatformReadings.mockImplementation(() => {
      if (!metadataResolved) {
        browseCalledBeforeMetadata = true;
      }
      return of('<browseXml/>');
    });

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(browseCalledBeforeMetadata).toBe(false);

    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'CO',
      discoveryTopic: 'MYTHS_AND_LEGENDS',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBe('MYTHS_AND_LEGENDS');
  });

  it('D: Valid country query param ?country=MX selects MX and its first topic with exactly 1 browse call', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'MX',
      discoveryTopic: 'HISTORY_AND_MEMORY',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBe('HISTORY_AND_MEMORY');
  });

  it('E: Invalid country query param ?country=ZZ falls back to first real backend country and first topic with exactly 1 browse call', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'ZZ' }));

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'CO',
      discoveryTopic: 'MYTHS_AND_LEGENDS',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBe('MYTHS_AND_LEGENDS');
  });

  it('re-uses loaded region metadata when query param changes while component is alive', () => {
    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);

    // Live queryParam change while alive
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
    fixture.detectChanges();

    // Metadata is NOT re-fetched
    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    // A second browse call is made for MX
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(2);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith({
      countryCode: 'MX',
      discoveryTopic: 'HISTORY_AND_MEMORY',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBe('HISTORY_AND_MEMORY');
  });

  it('A: Async route race safeguard ensures latest country emission wins without stale override', () => {
    const regionSubject = new Subject<string>();
    homeServiceMock.getDiscoveryRegionOverview.mockReturnValue(regionSubject.asObservable());

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).not.toHaveBeenCalled();

    // Change queryParam to MX while metadata is still pending
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
    fixture.detectChanges();

    // Metadata resolves now
    regionSubject.next('<regionXml/>');
    regionSubject.complete();
    fixture.detectChanges();

    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBe('HISTORY_AND_MEMORY');
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'MX',
      discoveryTopic: 'HISTORY_AND_MEMORY',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
  });

  it('countries are strictly backend-driven: renders backend countries and includes future countries automatically without code change', () => {
    createComponent();

    const countries = component.latamCountries();
    expect(countries.map((c) => c.code)).toEqual(['CO', 'MX', 'PE']);
    expect(countries.some((c) => c.code === 'EC')).toBe(false);
    expect(countries.some((c) => c.code === 'AR')).toBe(false);

    // Dynamic addition of Chile by backend
    const updatedOverview: DiscoveryRegionOverview = {
      ...mockRegionOverview,
      countries: [
        ...mockRegionOverview.countries,
        {
          countryCode: 'CL',
          displayName: 'Chile',
          tagline: 'Entre el mar y la cordillera',
          description: 'Historias chilenas',
          displayOrder: 4,
          readingCount: 5,
          heroImages: [],
          topics: [],
        },
      ],
    };
    component.latamOverview.set(updatedOverview);
    fixture.detectChanges();

    expect(component.latamCountries().some((c) => c.code === 'CL')).toBe(true);
  });

  it('topics are country-bound and switching country clears stale topics immediately', () => {
    createComponent();

    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBe('MYTHS_AND_LEGENDS');
    expect(component.activeTopics().map((t) => t.key)).toEqual([
      'MYTHS_AND_LEGENDS',
      'REAL_STORIES',
    ]);

    // Switch country to MX
    component.onCountryChange('MX');
    fixture.detectChanges();

    expect(component.selectedCountry()).toBe('MX');
    // Stale topic MYTHS_AND_LEGENDS is replaced with MX's first topic
    expect(component.selectedTopic()).toBe('HISTORY_AND_MEMORY');
    expect(component.activeTopics().map((t) => t.key)).toEqual(['HISTORY_AND_MEMORY']);
  });

  it('updates readings when topic is changed in UI', () => {
    createComponent();

    component.onTopicChange('REAL_STORIES');
    fixture.detectChanges();

    expect(component.selectedTopic()).toBe('REAL_STORIES');
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'CO',
      discoveryTopic: 'REAL_STORIES',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
  });

  it('hero is strictly backend-driven and uses neutral fallback when country has no hero without hardcoding Colombia', () => {
    createComponent();

    // CO has hero image in metadata
    expect(component.heroImageUrl()).toBe('/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp');

    // Switch to MX which has its own hero image
    component.onCountryChange('MX');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toBe('/assets/editorial/heroes/hero-mexico.webp');

    // Switch to PE which has 0 hero images: falls back to neutral fallback (null), never hardcoded Colombia!
    component.onCountryChange('PE');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
    expect(component.heroImageUrl()).toBeNull();
  });

  it('clearing filters in Latin America preserves country and resets topic to first country topic', () => {
    createComponent();

    component.onTopicChange('REAL_STORIES');
    component.onLevelChange('B2');
    expect(component.selectedTopic()).toBe('REAL_STORIES');
    expect(component.selectedLevel()).toBe('B2');

    component.onClearFilters();
    fixture.detectChanges();

    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBe('MYTHS_AND_LEGENDS');
    expect(component.selectedLevel()).toBeNull();
    expect(component.currentPage()).toBe(0);
  });

  it('handles /collections/new with sort CREATED_AT_DESC without loading region metadata', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'new' }));

    createComponent();

    expect(component.isNew()).toBe(true);
    expect(homeServiceMock.getDiscoveryRegionOverview).not.toHaveBeenCalled();
    expect(homeServiceMock.listCollections).not.toHaveBeenCalled();
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      sort: 'CREATED_AT_DESC',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.title()).toBe('Novedades');
  });

  it('handles generic editorial collection loading metadata and readings', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'colombian-myths-legends' }));

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).not.toHaveBeenCalled();
    expect(homeServiceMock.listCollections).toHaveBeenCalled();
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      collectionKey: 'colombian-myths-legends',
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.title()).toBe('Mitos y leyendas de Colombia');
  });
});
