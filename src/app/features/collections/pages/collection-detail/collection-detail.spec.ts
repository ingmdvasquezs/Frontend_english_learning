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
      heroKey: null,
      heroImages: [],
    },
    countries: [
      {
        countryCode: 'CO',
        displayName: 'Colombia',
        tagline: 'Tierra de realismo mágico',
        description: 'Historias de la memoria oral colombiana',
        displayOrder: 1,
        readingCount: 15,
        heroKey: 'countries/CO/hero.webp',
        heroImages: [
          {
            assetKey: 'countries/CO/hero.webp',
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
        heroKey: 'countries/MX/hero.webp',
        heroImages: [
          {
            assetKey: 'countries/MX/hero.webp',
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
        heroKey: 'countries/PE/hero.webp',
        heroImages: [
          {
            assetKey: 'countries/PE/hero.webp',
            location: 'Machu Picchu',
            alt: 'Machu Picchu',
            displayOrder: 1,
          },
        ],
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

  it('Initial Latin America without country query param loads region metadata and browses with null country (all region)', () => {
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
      countryCode: null,
      discoveryTopic: null,
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBeNull();
    expect(component.selectedTopic()).toBeNull();
  });

  it('Colombia with country=CO starts with topic=null (Todos) showing all its readings', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
    createComponent();

    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBeNull();

    const root = fixture.nativeElement as HTMLElement;
    const topicGroup = root.querySelector('.filter-group-topics');
    expect(topicGroup).toBeTruthy();
    const allTopicPill = topicGroup!.querySelector('.filter-pill.active') as HTMLButtonElement;
    expect(allTopicPill).toBeTruthy();
    expect(allTopicPill.textContent?.trim()).toBe('Todos');
  });

  it('D: Valid country query param ?country=MX selects MX and topic=null (Todos) with exactly 1 browse call', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'MX',
      discoveryTopic: null,
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBeNull();
  });

  it('E: Invalid country query param ?country=ZZ falls back to first real backend country and topic=null with exactly 1 browse call', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'ZZ' }));

    createComponent();

    expect(homeServiceMock.getDiscoveryRegionOverview).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'CO',
      discoveryTopic: null,
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBeNull();
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
    // A second browse call is made for MX with topic=null
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(2);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith({
      countryCode: 'MX',
      discoveryTopic: null,
      editorialLevel: null,
      page: 0,
      size: 12,
    });
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBeNull();
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
    expect(component.selectedTopic()).toBeNull();
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledTimes(1);
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'MX',
      discoveryTopic: null,
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
    queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
    createComponent();

    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBeNull();
    expect(component.activeTopics().map((t) => t.key)).toEqual([
      'MYTHS_AND_LEGENDS',
      'REAL_STORIES',
    ]);

    // Select a topic
    component.onTopicChange('REAL_STORIES');
    expect(component.selectedTopic()).toBe('REAL_STORIES');

    // Switch country to MX -> topic resets to null (Todos)
    component.onCountryChange('MX');
    fixture.detectChanges();

    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBeNull();
    expect(component.activeTopics().map((t) => t.key)).toEqual(['HISTORY_AND_MEMORY']);
  });

  it('updates readings when topic is changed in UI', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
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

  it('hero is strictly backend-driven and uses neutral fallback when country has no hero or image fails', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
    createComponent();

    // CO has hero image in metadata
    expect(component.heroImageUrl()).toContain('/countries/CO/hero.webp');

    // Switch to MX which has hero image key
    component.onCountryChange('MX');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toContain('/countries/MX/hero.webp');

    // Simulate 404 image error on Mexico hero
    component.onHeroImageError(component.heroImageUrl()!);
    fixture.detectChanges();
    // Gracefully falls back to NEUTRAL_LATAM_HERO_FALLBACK
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);

    // Switch to country with 0 hero images: uses NEUTRAL_LATAM_HERO_FALLBACK
    const withNoHeroCountry: DiscoveryRegionOverview = {
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
          heroKey: null,
          heroImages: [],
          topics: [],
        },
      ],
    };
    component.latamOverview.set(withNoHeroCountry);
    component.onCountryChange('CL');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
  });

  it('clearing filters in Latin America preserves country and resets topic to null (Todos)', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
    createComponent();

    component.onTopicChange('REAL_STORIES');
    component.onLevelChange('B2');
    expect(component.selectedTopic()).toBe('REAL_STORIES');
    expect(component.selectedLevel()).toBe('B2');

    component.onClearFilters();
    fixture.detectChanges();

    expect(component.selectedCountry()).toBe('CO');
    expect(component.selectedTopic()).toBeNull();
    expect(component.selectedLevel()).toBeNull();
    expect(component.currentPage()).toBe(0);
  });

  it('country=MX renders all 5 readings on entry with topic Todos, filters on topic selection, and restores 5 readings when returning to Todos', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));

    const fiveMexicoReadings: RecommendedPlatformReading[] = [
      { ...mockReading, readingId: 'mx-1', title: 'La Llorona en Xochimilco', countryCode: 'MX', discoveryTopic: 'MYTHS_AND_LEGENDS' },
      { ...mockReading, readingId: 'mx-2', title: 'El Popocatépetl y la Mujer Dormida', countryCode: 'MX', discoveryTopic: 'MYTHS_AND_LEGENDS' },
      { ...mockReading, readingId: 'mx-3', title: 'Historias de la Revolución', countryCode: 'MX', discoveryTopic: 'HISTORY_AND_MEMORY' },
      { ...mockReading, readingId: 'mx-4', title: 'Día de Muertos en Michoacán', countryCode: 'MX', discoveryTopic: 'CULTURE_AND_TRADITIONS' },
      { ...mockReading, readingId: 'mx-5', title: 'El Cenote Sagrado de Chichén Itzá', countryCode: 'MX', discoveryTopic: 'HISTORY_AND_MEMORY' },
    ];

    const fiveMexicoPage: BrowsePlatformReadingsPage = {
      page: 0,
      size: 12,
      totalElements: 5,
      readings: fiveMexicoReadings,
    };
    homeServiceMock.parseBrowsePlatformReadings.mockReturnValue(fiveMexicoPage);

    createComponent();

    // 1. Initial State: country=MX, topic=Todos (null), level=null
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBeNull();
    expect(component.readings().length).toBe(5);
    expect(component.countLabel()).toBe('5 historias');

    // Visual: topic pill "Todos" is active
    const root = fixture.nativeElement as HTMLElement;
    const topicGroup = root.querySelector('.filter-group-topics');
    expect(topicGroup).toBeTruthy();
    const allTopicPill = topicGroup!.querySelector('.filter-pill.active') as HTMLButtonElement;
    expect(allTopicPill).toBeTruthy();
    expect(allTopicPill.textContent?.trim()).toBe('Todos');

    // All 5 readings rendered in UI
    const cards = root.querySelectorAll('app-home-reading-card');
    expect(cards.length).toBe(5);

    // 2. Filter by specific topic
    homeServiceMock.parseBrowsePlatformReadings.mockReturnValue({
      page: 0,
      size: 12,
      totalElements: 2,
      readings: [fiveMexicoReadings[2], fiveMexicoReadings[4]],
    });
    component.onTopicChange('HISTORY_AND_MEMORY');
    fixture.detectChanges();

    expect(component.selectedTopic()).toBe('HISTORY_AND_MEMORY');
    expect(component.readings().length).toBe(2);
    expect(component.countLabel()).toBe('2 historias');
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith({
      countryCode: 'MX',
      discoveryTopic: 'HISTORY_AND_MEMORY',
      editorialLevel: null,
      page: 0,
      size: 12,
    });

    // 3. Return to "Todos" (topic = null)
    homeServiceMock.parseBrowsePlatformReadings.mockReturnValue(fiveMexicoPage);
    component.onTopicChange(null);
    fixture.detectChanges();

    expect(component.selectedTopic()).toBeNull();
    expect(component.readings().length).toBe(5);
    expect(component.countLabel()).toBe('5 historias');
    expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith({
      countryCode: 'MX',
      discoveryTopic: null,
      editorialLevel: null,
      page: 0,
      size: 12,
    });
  });

  it('never displays broken image or naked alt text in collection hero on image error', () => {
    createComponent();

    const root = fixture.nativeElement as HTMLElement;
    const heroImg = root.querySelector('.hero-img') as HTMLImageElement;
    expect(heroImg).toBeTruthy();

    // Trigger error on primary image
    heroImg.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    // Still has a valid fallback image or fallback container, never broken alt
    const currentImg = root.querySelector('.hero-img') as HTMLImageElement;
    if (currentImg) {
      expect(currentImg.getAttribute('src')).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
    } else {
      expect(root.querySelector('.hero-fallback')).toBeTruthy();
    }
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

  it('resolves Platform Media coverKey for editorial collection', () => {
    const platformMediaCollection: ReadingCollection = {
      key: 'movies-and-cinema',
      displayName: 'Cine y Películas',
      description: 'Lecturas de cine',
      displayOrder: 2,
      coverKey: 'collections/movies-and-cinema/hero.webp',
      readingCount: 8,
    };
    homeServiceMock.parseCollections.mockReturnValue([platformMediaCollection]);

    paramMapSubject.next(convertToParamMap({ slug: 'movies-and-cinema' }));
    createComponent();

    expect(component.heroImageUrl()).toContain('/collections/movies-and-cinema/hero.webp');
  });

  it('resolves Platform Media hero key for Latin America country', () => {
    const platformCountryOverview: DiscoveryRegionOverview = {
      region: {
        key: 'latin-america',
        displayName: 'Descubre Latinoamérica',
        subtitle: 'Historias',
      },
      countries: [
        {
          countryCode: 'MX',
          displayName: 'México',
          tagline: 'Cultura ancestral',
          description: 'Historias de México',
          displayOrder: 1,
          readingCount: 5,
          heroImages: [
            {
              assetKey: 'countries/MX/hero.webp',
              location: 'Chichen Itza',
              alt: 'Chichen Itza',
              displayOrder: 1,
            },
          ],
          topics: [],
        },
      ],
    };
    homeServiceMock.parseDiscoveryRegionOverview.mockReturnValue(platformCountryOverview);

    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
    createComponent();

    expect(component.heroImageUrl()).toContain('/countries/MX/hero.webp');
  });

  it('Phase 19.5D - A: without country selected uses Latin America region hero fallback', () => {
    createComponent();

    expect(component.selectedCountry()).toBeNull();
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
  });

  it('Phase 19.5D - B: country MX with hero resolves MX country hero URL', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
    createComponent();

    expect(component.selectedCountry()).toBe('MX');
    expect(component.heroImageUrl()).toContain('/countries/MX/hero.webp');
  });

  it('Phase 19.5D - C: country PE resolves PE hero URL', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'PE' }));
    createComponent();

    expect(component.selectedCountry()).toBe('PE');
    expect(component.heroImageUrl()).toContain('/countries/PE/hero.webp');
  });

  it('Phase 19.5D - D: country missing hero falls back to region hero', () => {
    const withNoHeroCountry: DiscoveryRegionOverview = {
      ...mockRegionOverview,
      countries: [
        ...mockRegionOverview.countries,
        {
          countryCode: 'EC',
          displayName: 'Ecuador',
          tagline: 'Mitad del mundo',
          description: 'Historias ecuatorianas',
          displayOrder: 4,
          readingCount: 4,
          heroKey: null,
          heroImages: [],
          topics: [],
        },
      ],
    };
    homeServiceMock.parseDiscoveryRegionOverview.mockReturnValue(withNoHeroCountry);
    queryParamMapSubject.next(convertToParamMap({ country: 'EC' }));
    createComponent();

    expect(component.selectedCountry()).toBe('EC');
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
  });

  it('Phase 19.5D - E: changing country updates hero immediately via Signals without page reload', () => {
    queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
    createComponent();

    expect(component.heroImageUrl()).toContain('/countries/MX/hero.webp');

    // Switch to Peru
    component.onCountryChange('PE');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toContain('/countries/PE/hero.webp');

    // Switch to Colombia
    component.onCountryChange('CO');
    fixture.detectChanges();
    expect(component.heroImageUrl()).toContain('/countries/CO/hero.webp');

    // Switch to no country (null) -> region hero fallback
    component.onCountryChange(null);
    fixture.detectChanges();
    expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);
  });
});
