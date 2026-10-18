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
    const countrySwitcher = root.querySelector('.country-switcher');
    expect(countrySwitcher).toBeTruthy();
    const activeCountryPill = countrySwitcher!.querySelector('.country-pill.active');
    expect(activeCountryPill?.textContent?.trim()).toBe('Colombia');
    expect(root.querySelector('.filter-group-topics')).toBeNull();
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

  it('country=MX renders all 5 readings on entry, displays country switcher without top topic/level filters, and filters on topic selection', () => {
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

    // 1. Initial State: country=MX, topic=null, level=null
    expect(component.selectedCountry()).toBe('MX');
    expect(component.selectedTopic()).toBeNull();
    expect(component.readings().length).toBe(5);
    expect(component.countLabel()).toBe('5 historias');

    const root = fixture.nativeElement as HTMLElement;
    // Country switcher is rendered with MX active
    const countrySwitcher = root.querySelector('.country-switcher');
    expect(countrySwitcher).toBeTruthy();
    const activeCountryPill = countrySwitcher!.querySelector('.country-pill.active');
    expect(activeCountryPill?.textContent?.trim()).toBe('México');

    // NO upper topic filter or level filter
    expect(root.querySelector('.filter-group-topics')).toBeNull();
    expect(root.querySelector('.filter-group-levels')).toBeNull();

    // Readings rendered in UI
    const cards = root.querySelectorAll('app-home-reading-card');
    expect(cards.length).toBeGreaterThan(0);

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

    // 3. Return to null topic
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

  describe('Phase 19.6 Country Collection Redesign', () => {
    it('Requirement A & K: ?country=CO renders Colombia landing with country switcher, featured, topic rail, and NO territory or upper filters', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      expect(component.isCountryLanding()).toBe(true);
      expect(component.title()).toBe('Colombia');
      expect(component.activeCountry()?.countryCode).toBe('CO');

      const root = fixture.nativeElement as HTMLElement;

      // 1. Breadcrumb: Inicio / Latinoamérica / Colombia
      const breadcrumb = root.querySelector('.detail-breadcrumb');
      expect(breadcrumb).toBeTruthy();
      expect(breadcrumb?.textContent).toContain('Inicio');
      expect(breadcrumb?.textContent).toContain('Latinoamérica');
      expect(breadcrumb?.textContent).toContain('Colombia');

      // 2. Split Country Hero
      const heroSection = root.querySelector('.country-hero-section');
      expect(heroSection).toBeTruthy();
      expect(heroSection?.querySelector('.country-hero-title')?.textContent?.trim()).toBe('Colombia');
      expect(heroSection?.querySelector('.country-hero-eyebrow')?.textContent).toContain('LATINOAMÉRICA · COLOMBIA');
      expect(heroSection?.querySelector('.country-hero-tagline')?.textContent).toContain('Tierra de realismo mágico');
      expect(heroSection?.querySelector('.country-hero-chips')?.textContent).toContain('15 historias');

      // 3. Country Switcher: Colombia active, NO topic/level filter
      const countrySwitcher = root.querySelector('.country-switcher');
      expect(countrySwitcher).toBeTruthy();
      expect(countrySwitcher?.querySelector('.country-pill.active')?.textContent?.trim()).toBe('Colombia');
      expect(root.querySelector('.filter-group-topics')).toBeNull();
      expect(root.querySelector('.filter-group-levels')).toBeNull();

      // 4. NO Territory Panel or Maps
      expect(root.querySelector('.territory-card')).toBeNull();
      expect(root.querySelector('.colombia-vector-map')).toBeNull();
      expect(root.querySelector('.territory-pillars')).toBeNull();

      // 5. Featured Readings Section
      expect(root.querySelector('.country-featured-section')).toBeTruthy();
      expect(root.querySelector('#country-featured-heading')?.textContent).toContain('Colombia');

      // 6. Topic Section (Mitos y leyendas)
      const topicSections = root.querySelectorAll('.topic-editorial-section');
      expect(topicSections.length).toBeGreaterThan(0);
      expect(topicSections[0].textContent).toContain('Mitos y leyendas');

      // 7. Full catalog
      expect(root.querySelector('#all-stories')).toBeTruthy();
    });

    it('Requirement B: ?country=MX renders Mexico with identical editorial structure and Mexico data', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
      createComponent();

      expect(component.isCountryLanding()).toBe(true);
      expect(component.title()).toBe('México');
      expect(component.activeCountry()?.countryCode).toBe('MX');

      const root = fixture.nativeElement as HTMLElement;
      const heroTitle = root.querySelector('.country-hero-title');
      expect(heroTitle?.textContent?.trim()).toBe('México');
      expect(root.querySelector('.country-hero-eyebrow')?.textContent).toContain('LATINOAMÉRICA · MÉXICO');

      // Country switcher active is México
      expect(root.querySelector('.country-switcher .country-pill.active')?.textContent?.trim()).toBe('México');

      // NO territory block
      expect(root.querySelector('.territory-card')).toBeNull();
      expect(root.querySelector('.colombia-vector-map')).toBeNull();

      // Featured and Topic sections for Mexico
      expect(root.querySelector('#country-featured-heading')?.textContent).toContain('México');
      const topicSections = root.querySelectorAll('.topic-editorial-section');
      expect(topicSections.length).toBeGreaterThan(0);
      expect(topicSections[0].textContent).toContain('Historia y memoria');

      // Full catalog
      expect(root.querySelector('#all-stories')?.textContent).toContain('México');
    });

    it('Requirement B2: ?country=PE renders Peru with identical editorial structure', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'PE' }));
      createComponent();

      expect(component.isCountryLanding()).toBe(true);
      expect(component.title()).toBe('Perú');
      expect(component.activeCountry()?.countryCode).toBe('PE');

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.country-hero-title')?.textContent?.trim()).toBe('Perú');
      expect(root.querySelector('.country-switcher .country-pill.active')?.textContent?.trim()).toBe('Perú');
      expect(root.querySelector('.territory-card')).toBeNull();
      expect(root.querySelector('#country-featured-heading')?.textContent).toContain('Perú');
      expect(root.querySelector('#all-stories')?.textContent).toContain('Perú');
    });

    it('Requirement C: Switching country CO -> MX updates Signals dynamically without reload', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      expect(component.title()).toBe('Colombia');
      expect(component.selectedCountry()).toBe('CO');

      component.onCountryChange('MX');
      fixture.detectChanges();

      expect(component.title()).toBe('México');
      expect(component.selectedCountry()).toBe('MX');
      expect(component.activeCountry()?.displayName).toBe('México');
      expect(component.activeTopics().map((t) => t.key)).toEqual(['HISTORY_AND_MEMORY']);

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.country-hero-title')?.textContent?.trim()).toBe('México');
    });

    it('Requirement D & E: Resolves correct hero per country and handles fallback gracefully', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'MX' }));
      createComponent();

      expect(component.heroImageUrl()).toContain('countries/MX/hero.webp');

      // Trigger hero error -> fallback to region neutral hero
      component.onHeroImageError(component.heroImageUrl()!);
      fixture.detectChanges();
      expect(component.heroImageUrl()).toBe(NEUTRAL_LATAM_HERO_FALLBACK);

      // Trigger error on neutral fallback as well -> null (shows svg fallback template)
      component.onHeroImageError(NEUTRAL_LATAM_HERO_FALLBACK);
      fixture.detectChanges();
      expect(component.heroImageUrl()).toBeNull();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.country-hero-media .hero-fallback')).toBeTruthy();
    });

    it('Requirement F & G: Topics with readingCount === 0 are excluded from activeTopics and topicSections', () => {
      const overviewWithEmptyTopic: DiscoveryRegionOverview = {
        ...mockRegionOverview,
        countries: [
          {
            ...mockRegionOverview.countries[0],
            topics: [
              {
                key: 'MYTHS_AND_LEGENDS',
                displayName: 'Mitos y leyendas',
                displayOrder: 1,
                readingCount: 10,
              },
              {
                key: 'EMPTY_TOPIC',
                displayName: 'Tema vacío',
                displayOrder: 2,
                readingCount: 0,
              },
              {
                key: 'REAL_STORIES',
                displayName: 'Historias reales',
                displayOrder: 3,
                readingCount: 5,
              },
            ],
          },
        ],
      };
      homeServiceMock.parseDiscoveryRegionOverview.mockReturnValue(overviewWithEmptyTopic);
      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      const activeTopicKeys = component.activeTopics().map((t) => t.key);
      expect(activeTopicKeys).toContain('MYTHS_AND_LEGENDS');
      expect(activeTopicKeys).toContain('REAL_STORIES');
      expect(activeTopicKeys).not.toContain('EMPTY_TOPIC');

      const sectionTopicKeys = component.topicSections().map((s) => s.topic.key);
      expect(sectionTopicKeys).toContain('MYTHS_AND_LEGENDS');
      expect(sectionTopicKeys).toContain('REAL_STORIES');
      expect(sectionTopicKeys).not.toContain('EMPTY_TOPIC');
    });

    it('Requirement H & I: Featured readings belong to active country and shortDescription remains in English', () => {
      const readingsWithEnglishTeaser: RecommendedPlatformReading[] = [
        {
          ...mockReading,
          readingId: 'rd-1',
          title: 'The Legend of El Dorado',
          editorialLevel: 'B2',
          category: 'CULTURE_ARTS_AND_FICTION',
          vocabularyFitPercentage: 88,
          uniqueWords: 240,
          shortDescription:
            'Discover the ancient Indigenous myth of the gilded ruler and the sacred lake of Guatavita.',
          discoveryTopic: 'MYTHS_AND_LEGENDS',
        },
        {
          ...mockReading,
          readingId: 'rd-2',
          title: 'The Coffee Route',
          editorialLevel: 'A2',
          category: 'NATURE_AND_GEOGRAPHY',
          vocabularyFitPercentage: 92,
          uniqueWords: 180,
          shortDescription:
            'Explore the high-altitude Andes mountains where Colombia cultivates the world finest arabica coffee beans.',
          discoveryTopic: 'REAL_STORIES',
        },
      ];

      homeServiceMock.parseBrowsePlatformReadings.mockReturnValue({
        page: 0,
        size: 12,
        totalElements: 2,
        readings: readingsWithEnglishTeaser,
      });

      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      expect(component.featuredReadings().length).toBe(2);
      expect(component.featuredReadings()[0].title).toBe('The Legend of El Dorado');

      // CEFR range calculation
      expect(component.cefrRange()).toBe('A2 – B2');

      // Featured topic determination (highest readingCount)
      expect(component.featuredTopic()?.key).toBe('MYTHS_AND_LEGENDS');

      // UI verification: standard app-home-reading-card in featured readings section
      const root = fixture.nativeElement as HTMLElement;
      const featuredCards = root.querySelectorAll('.country-featured-section app-home-reading-card');
      expect(featuredCards.length).toBe(2);

      const firstCardDesc = featuredCards[0].querySelector('.reading-card-desc');
      expect(firstCardDesc?.textContent?.trim()).toBe(
        'Discover the ancient Indigenous myth of the gilded ruler and the sacred lake of Guatavita.'
      );

      const firstCardTooltip = featuredCards[0].querySelector('.reading-card-desc-tooltip');
      expect(firstCardTooltip?.textContent?.trim()).toBe(
        'Discover the ancient Indigenous myth of the gilded ruler and the sacred lake of Guatavita.'
      );
    });

    it('Requirement J: Filter actions (topic, level, clear) trigger appropriate browse requests', () => {
      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      // Topic change
      component.onTopicChange('MYTHS_AND_LEGENDS');
      expect(component.selectedTopic()).toBe('MYTHS_AND_LEGENDS');
      expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          countryCode: 'CO',
          discoveryTopic: 'MYTHS_AND_LEGENDS',
          editorialLevel: null,
          page: 0,
        })
      );

      // Level change
      component.onLevelChange('B1');
      expect(component.selectedLevel()).toBe('B1');
      expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          countryCode: 'CO',
          discoveryTopic: 'MYTHS_AND_LEGENDS',
          editorialLevel: 'B1',
          page: 0,
        })
      );

      // Clear filters
      component.onClearFilters();
      expect(component.selectedTopic()).toBeNull();
      expect(component.selectedLevel()).toBeNull();
      expect(component.selectedCountry()).toBe('CO');
      expect(homeServiceMock.browsePlatformReadings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          countryCode: 'CO',
          discoveryTopic: null,
          editorialLevel: null,
          page: 0,
        })
      );
    });

    it('calculates CEFR range correctly with single level, multiple levels, or empty levels', () => {
      createComponent();

      // Default mock has 1 reading with 'B1'
      expect(component.cefrRange()).toBe('B1');

      // Empty readings
      component.readings.set([]);
      expect(component.cefrRange()).toBe('A1 – C2');

      // Multiple levels: A1 and C1
      component.readings.set([
        { ...mockReading, editorialLevel: 'A1' },
        { ...mockReading, editorialLevel: 'C1' },
      ]);
      expect(component.cefrRange()).toBe('A1 – C1');
    });

    it('topic rail reading card links to reader route', () => {
      const readingsForTopics: RecommendedPlatformReading[] = [
        {
          ...mockReading,
          readingId: 'rd-myth-1',
          title: 'The Silbón Legend',
          editorialLevel: 'B1',
          discoveryTopic: 'MYTHS_AND_LEGENDS',
        },
      ];
      homeServiceMock.parseBrowsePlatformReadings.mockReturnValue({
        page: 0,
        size: 12,
        totalElements: 1,
        readings: readingsForTopics,
      });

      queryParamMapSubject.next(convertToParamMap({ country: 'CO' }));
      createComponent();

      const root = fixture.nativeElement as HTMLElement;
      const topicRailCard = root.querySelector('.topic-editorial-section app-home-reading-card a') as HTMLAnchorElement;
      expect(topicRailCard).toBeTruthy();
      expect(topicRailCard.getAttribute('href')).toBe('/reading/rd-myth-1');
      expect(topicRailCard.textContent).toContain('The Silbón Legend');
    });
  });
});
