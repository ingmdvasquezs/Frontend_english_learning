import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import {
  COUNTRY_AUTOPLAY_MS,
  DEFAULT_LATAM_OVERVIEW,
  EditorialUniverse,
  LATAM_COUNTRY_HERO_ASSETS,
  LATAM_VISUAL_PREVIEW_COUNTRIES,
  resolveBaseCta,
  resolveHeroAssetUrl,
  resolveReadingCta,
  resolveReadingFitTone,
  resolveRevealCta,
  resolveTopicIcon,
} from './editorial-universe';
import { HomeService } from '../../services/home';
import {
  DiscoveryRegionOverview,
  RecommendedPlatformReading,
} from '../../models/home.models';

function mockReading(overrides: Partial<RecommendedPlatformReading> = {}): RecommendedPlatformReading {
  return {
    readingId: 'reading-1',
    title: 'The Mohán and the Spring of Water',
    language: 'en',
    editorialLevel: 'B1',
    category: 'Culture, Arts & Fiction',
    createdAt: '2026-09-15T16:00:00Z',
    uniqueWords: 252,
    knownWords: 0,
    learningWords: 0,
    explicitNewWords: 0,
    ignoredWords: 0,
    unclassifiedWords: 252,
    vocabularyFitPercentage: 30,
    classificationConfidencePercentage: 0,
    progressStatus: null,
    coverKey: 'mohan-pasuncha',
    reasonCode: 'DISCOVERY',
    description: 'A woman from Pasuncha shares her last tobacco with a mysterious old traveler.',
    countryCode: 'CO',
    discoveryTopic: 'MYTHS_AND_LEGENDS',
    ...overrides,
  };
}

const FIFTEEN_REAL_READINGS: RecommendedPlatformReading[] = Array.from({ length: 15 }, (_, i) =>
  mockReading({
    readingId: `reading-${i + 1}`,
    title: `Reading Title ${i + 1}`,
    coverKey: `cover-${i + 1}`,
    editorialLevel: i % 2 === 0 ? 'B1' : 'B2',
    progressStatus: i === 1 ? 'IN_PROGRESS' : i === 2 ? 'COMPLETED' : null,
  })
);

const MOCK_LATAM_OVERVIEW: DiscoveryRegionOverview = {
  region: {
    key: 'latin-america',
    displayName: 'Latinoamérica',
    subtitle: 'Historias, cultura y lugares de nuestra región.',
  },
  countries: [
    {
      countryCode: 'CO',
      displayName: 'Colombia',
      tagline: 'Historias, lugares, mitos y tradiciones para aprender inglés leyendo.',
      description: 'Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.',
      displayOrder: 1,
      readingCount: 15,
      heroImages: [
        {
          assetKey: 'editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp',
          location: 'Villa de Leyva, Boyacá',
          alt: 'Villa de Leyva, Boyacá',
          displayOrder: 1,
        },
        {
          assetKey: 'editorial/heroes/colombia/hero-colombia-valle-de-cocora.webp',
          location: 'Valle de Cocora, Quindío',
          alt: 'Valle de Cocora, Quindío',
          displayOrder: 2,
        },
      ],
      topics: [
        {
          key: 'MYTHS_AND_LEGENDS',
          displayName: 'Mitos y leyendas',
          displayOrder: 1,
          readingCount: 15,
        },
      ],
    },
  ],
};

const MOCK_MULTI_COUNTRY_OVERVIEW: DiscoveryRegionOverview = {
  region: {
    key: 'latin-america',
    displayName: 'Latinoamérica',
    subtitle: 'Historias, cultura y lugares de nuestra región.',
  },
  countries: [
    {
      countryCode: 'CO',
      displayName: 'Colombia',
      tagline: 'Muchas historias. Un lugar increíble.',
      description: 'Personas extraordinarias de Colombia.',
      displayOrder: 1,
      readingCount: 15,
      heroImages: [
        {
          assetKey: 'editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp',
          location: 'Villa de Leyva',
          alt: 'Villa de Leyva',
          displayOrder: 1,
        },
      ],
      topics: [
        {
          key: 'MYTHS_AND_LEGENDS',
          displayName: 'Mitos y leyendas',
          displayOrder: 1,
          readingCount: 15,
        },
      ],
    },
    {
      countryCode: 'PE',
      displayName: 'Perú',
      tagline: 'Tierra milenaria y misteriosa.',
      description: 'Cultura andina e historias vivas.',
      displayOrder: 2,
      readingCount: 8,
      heroImages: [
        {
          assetKey: 'editorial/heroes/peru/hero-peru-machu-picchu.webp',
          location: 'Cusco, Perú',
          alt: 'Machu Picchu',
          displayOrder: 1,
        },
      ],
      topics: [
        {
          key: 'MYTHS_AND_LEGENDS',
          displayName: 'Mitos incas',
          displayOrder: 1,
          readingCount: 8,
        },
        {
          key: 'HISTORY_AND_MEMORY',
          displayName: 'Historia',
          displayOrder: 2,
          readingCount: 5,
        },
      ],
    },
    {
      countryCode: 'MX',
      displayName: 'México',
      tagline: 'Color, tradición y leyendas ancestrales.',
      description: 'Voces de la tierra mexica y maya.',
      displayOrder: 3,
      readingCount: 12,
      heroImages: [
        {
          assetKey: 'editorial/heroes/mexico/hero-mexico-teotihuacan.webp',
          location: 'Teotihuacán',
          alt: 'Pirámides',
          displayOrder: 1,
        },
      ],
      topics: [
        {
          key: 'MYTHS_AND_LEGENDS',
          displayName: 'Leyendas de México',
          displayOrder: 1,
          readingCount: 12,
        },
      ],
    },
  ],
};

describe('EditorialUniverse', () => {
  let fixture: ComponentFixture<EditorialUniverse>;
  let component: EditorialUniverse;
  let homeService: {
    getDiscoveryRegionOverview: ReturnType<typeof vi.fn>;
    parseDiscoveryRegionOverview: ReturnType<typeof vi.fn>;
    browsePlatformReadings: ReturnType<typeof vi.fn>;
    parseBrowsePlatformReadings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    homeService = {
      getDiscoveryRegionOverview: vi.fn().mockReturnValue(of('<overviewXml/>')),
      parseDiscoveryRegionOverview: vi.fn().mockReturnValue(MOCK_LATAM_OVERVIEW),
      browsePlatformReadings: vi.fn().mockReturnValue(of('<browseXml/>')),
      parseBrowsePlatformReadings: vi.fn().mockReturnValue({
        page: 0,
        size: 20,
        totalElements: 15,
        readings: FIFTEEN_REAL_READINGS,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [EditorialUniverse],
      providers: [
        provideRouter([]),
        { provide: HomeService, useValue: homeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorialUniverse);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. loads overview and sets Latin America region title and subtitle', () => {
    fixture.detectChanges();
    expect(homeService.getDiscoveryRegionOverview).toHaveBeenCalledWith('latin-america');
    expect(homeService.parseDiscoveryRegionOverview).toHaveBeenCalledWith('<overviewXml/>');
    expect(component.regionName()).toBe('Latinoamérica');
    expect(component.regionSubtitle()).toBe('Historias, cultura y lugares de nuestra región.');

    const titleEl = fixture.nativeElement.querySelector('.latam-region-title');
    const subEl = fixture.nativeElement.querySelector('.latam-region-subtitle');
    expect(titleEl.textContent).toContain('Descubre Latinoamérica');
    expect(subEl.textContent).toContain('Historias, cultura y lugares de nuestra región.');
  });

  it('2. defaults to Colombia (CO) and MYTHS_AND_LEGENDS topic', () => {
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('CO');
    expect(component.activeTopicKey()).toBe('MYTHS_AND_LEGENDS');
    expect(component.activeCountry()?.displayName).toBe('Colombia');
    expect(component.activeTopic()?.displayName).toBe('Mitos y leyendas');
  });

  it('3. active country Colombia has readingCount = 15', () => {
    fixture.detectChanges();
    expect(component.activeCountry()?.readingCount).toBe(15);
  });

  it('4. renders 4 country pills in preview mode (Colombia, Perú, Ecuador, Argentina) without "Todos"', () => {
    fixture.detectChanges();
    const pills = fixture.nativeElement.querySelectorAll('.country-pill');
    expect(pills.length).toBe(4);
    expect(pills[0].textContent).toContain('Colombia');
    expect(pills[1].textContent).toContain('Perú');
    expect(pills[2].textContent).toContain('Ecuador');
    expect(pills[3].textContent).toContain('Argentina');
    expect(pills[0].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).not.toContain('Todos');
  });

  it('5. renders active topic pill for Colombia', () => {
    fixture.detectChanges();
    const topicPill = fixture.nativeElement.querySelector('.topic-selector-group .topic-pill');
    expect(topicPill).toBeTruthy();
    expect(topicPill.textContent).toContain('Mitos y leyendas');
    expect(topicPill.getAttribute('aria-pressed')).toBe('true');
  });

  it('6. calls browsePlatformReadings with CO, MYTHS_AND_LEGENDS, page 0, size 20', () => {
    fixture.detectChanges();
    expect(homeService.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'CO',
      discoveryTopic: 'MYTHS_AND_LEGENDS',
      page: 0,
      size: 20,
    });
  });

  it('7. renders 15 real readings in the rail with valid links and editorial badges', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards.length).toBe(15);

    const firstCard = cards[0] as HTMLElement;
    expect(firstCard.getAttribute('href')).toBe('/reading/reading-1');
    expect(firstCard.querySelector('.story-title')?.textContent).toContain('Reading Title 1');
    expect(firstCard.querySelector('.story-level-badge')?.textContent).toContain('B1');
  });

  it('8. renders vocabulary fit indicator on each story card', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    for (const card of Array.from(cards)) {
      const fitEl = (card as HTMLElement).querySelector('.vocab-fit-indicator');
      expect(fitEl).toBeTruthy();
      expect((fitEl as HTMLElement).textContent).toContain('30% vocab fit');
    }
  });

  it('9. starts in AUTO interaction mode', () => {
    expect(component.interactionMode()).toBe('AUTO');
  });

  it('10. switches interactionMode to USER_CONTROLLED on country pill click', () => {
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('.country-pill') as HTMLButtonElement;
    pill.click();
    expect(component.interactionMode()).toBe('USER_CONTROLLED');
  });

  it('11. switches interactionMode to USER_CONTROLLED on topic pill click', () => {
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('.topic-selector-group .topic-pill') as HTMLButtonElement;
    pill.click();
    expect(component.interactionMode()).toBe('USER_CONTROLLED');
  });

  it('12. switches interactionMode to USER_CONTROLLED on hero CTA click and smooth scrolls to #discoveryContent without router navigation', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const scrollSpy = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;

    try {
      fixture.detectChanges();
      const cta = fixture.nativeElement.querySelector('.latam-hero-cta') as HTMLButtonElement;
      expect(cta).toBeTruthy();
      expect(cta.textContent).toContain('Descubrir Colombia');

      cta.click();
      expect(component.interactionMode()).toBe('USER_CONTROLLED');
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
      expect(navigateSpy).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('13. switches interactionMode to USER_CONTROLLED on rail scrollStories, touch, and focus', () => {
    fixture.detectChanges();
    expect(component.interactionMode()).toBe('AUTO');

    component.scrollStories('next');
    expect(component.interactionMode()).toBe('USER_CONTROLLED');

    component.interactionMode.set('AUTO');
    component.onRailTouch();
    expect(component.interactionMode()).toBe('USER_CONTROLLED');

    component.interactionMode.set('AUTO');
    component.onInteractiveFocus();
    expect(component.interactionMode()).toBe('USER_CONTROLLED');
  });

  it('14. switches interactionMode to USER_CONTROLLED on hero dots click', () => {
    fixture.detectChanges();
    const dots = fixture.nativeElement.querySelectorAll('.colombia-banner-dot');
    expect(dots.length).toBe(2);

    (dots[1] as HTMLButtonElement).click();
    expect(component.interactionMode()).toBe('USER_CONTROLLED');
    expect(component.activeHeroImageIndex()).toBe(1);
  });

  it('15. rotates countries every ~5s in AUTO mode (CO -> PE -> EC -> AR -> CO)', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    expect(component.activeCountryCode()).toBe('CO');
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeCountryCode()).toBe('PE');
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeCountryCode()).toBe('EC');
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeCountryCode()).toBe('AR');
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeCountryCode()).toBe('CO');
  });

  it('16. pauses country rotation on banner mouseenter and resumes on mouseleave', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.colombia-featured-banner') as HTMLElement;
    banner.dispatchEvent(new MouseEvent('mouseenter'));
    expect(component.isHoverPaused()).toBe(true);

    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS * 2);
    expect(component.activeCountryCode()).toBe('CO');

    banner.dispatchEvent(new MouseEvent('mouseleave'));
    expect(component.isHoverPaused()).toBe(false);

    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeCountryCode()).toBe('PE');
  });

  it('17. reduced motion disables autoplay rotation', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;

    try {
      const customFixture = TestBed.createComponent(EditorialUniverse);
      vi.useFakeTimers();
      customFixture.detectChanges();

      expect(customFixture.componentInstance.activeCountryCode()).toBe('CO');
      vi.advanceTimersByTime(14000);
      expect(customFixture.componentInstance.activeCountryCode()).toBe('CO');
      customFixture.destroy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('18. cancels in-flight subscription when selecting another country or topic', () => {
    fixture.componentRef.setInput('customOverview', MOCK_MULTI_COUNTRY_OVERVIEW);
    fixture.detectChanges();

    const firstSub$ = new Subject<string>();
    const secondSub$ = new Subject<string>();
    homeService.browsePlatformReadings
      .mockReturnValueOnce(firstSub$)
      .mockReturnValueOnce(secondSub$);

    component.selectCountry('PE');
    expect(firstSub$.observed).toBe(true);

    component.selectCountry('MX');
    expect(firstSub$.observed).toBe(false);
    expect(secondSub$.observed).toBe(true);
  });

  it('19. shows error state on SOAP failure and retries on retry button click', () => {
    homeService.browsePlatformReadings.mockReturnValueOnce(
      throwError(() => new Error('SOAP Fault 500'))
    );

    fixture.detectChanges();
    expect(component.readingsError()).toBe('No se pudieron cargar las historias.');

    const errorEl = fixture.nativeElement.querySelector('.universe-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('No se pudieron cargar las historias.');

    const retryBtn = errorEl.querySelector('.universe-retry-btn') as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();

    homeService.browsePlatformReadings.mockReturnValueOnce(of('<newXml/>'));
    retryBtn.click();
    fixture.detectChanges();

    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(2);
  });

  it('20. shows empty state when 0 readings are returned', () => {
    homeService.parseBrowsePlatformReadings.mockReturnValue({
      page: 0,
      size: 20,
      totalElements: 0,
      readings: [],
    });

    fixture.detectChanges();
    expect(component.realReadings().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      'No hay historias disponibles para esta selección.'
    );
  });

  it('21. multi-country fixture support: renders 3 country pills and switches country cleanly', () => {
    fixture.componentRef.setInput('customOverview', MOCK_MULTI_COUNTRY_OVERVIEW);
    fixture.detectChanges();

    const pills = fixture.nativeElement.querySelectorAll('.country-pill');
    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toContain('Colombia');
    expect(pills[1].textContent).toContain('Perú');
    expect(pills[2].textContent).toContain('México');

    // Select Perú
    (pills[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.activeCountryCode()).toBe('PE');
    expect(component.interactionMode()).toBe('USER_CONTROLLED');
    expect(component.activeTopicKey()).toBe('MYTHS_AND_LEGENDS');
    expect(homeService.browsePlatformReadings).toHaveBeenCalledWith({
      countryCode: 'PE',
      discoveryTopic: 'MYTHS_AND_LEGENDS',
      page: 0,
      size: 20,
    });
  });

  it('22. caches readings and avoids redundant SOAP calls for identical selection', () => {
    fixture.componentRef.setInput('customOverview', MOCK_MULTI_COUNTRY_OVERVIEW);
    fixture.detectChanges();

    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(1);

    // Switch to Peru
    component.selectCountry('PE');
    fixture.detectChanges();
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(2);

    // Switch back to Colombia -> should use cache!
    component.selectCountry('CO');
    fixture.detectChanges();
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(2);
    expect(component.realReadings().length).toBe(15);
  });

  it('23. tests utility functions: resolveHeroAssetUrl, resolveTopicIcon, CTAs, fitTone', () => {
    expect(resolveHeroAssetUrl('editorial/heroes/colombia/hero.webp')).toBe(
      '/assets/editorial/heroes/colombia/hero.webp'
    );
    expect(resolveHeroAssetUrl('/assets/editorial/heroes/colombia/hero.webp')).toBe(
      '/assets/editorial/heroes/colombia/hero.webp'
    );
    expect(resolveHeroAssetUrl('https://cdn.example.com/hero.webp')).toBe(
      'https://cdn.example.com/hero.webp'
    );
    expect(resolveHeroAssetUrl(null)).toBe('');

    expect(resolveTopicIcon('MYTHS_AND_LEGENDS')).toBe('🌙');
    expect(resolveTopicIcon('REAL_STORIES')).toBe('👥');
    expect(resolveTopicIcon('HISTORY_AND_MEMORY')).toBe('🏛️');
    expect(resolveTopicIcon('UNKNOWN')).toBe('📖');

    expect(resolveBaseCta('COMPLETED')).toBe('Re-read →');
    expect(resolveBaseCta('IN_PROGRESS')).toBe('Continue →');
    expect(resolveBaseCta(null)).toBe('Open →');

    expect(resolveRevealCta('COMPLETED')).toBe('Re-read →');
    expect(resolveRevealCta('IN_PROGRESS')).toBe('Continue reading →');
    expect(resolveRevealCta(null)).toBe('Open reading →');
    expect(resolveReadingCta(null)).toBe('Open reading →');

    const reading = mockReading({ reasonCode: 'DISCOVERY', classificationConfidencePercentage: 0 });
    expect(resolveReadingFitTone(reading)).toBe('discovery');
  });

  it('24. resolves the 4 official LatAm WebP hero assets correctly and connects defaults', () => {
    expect(
      resolveHeroAssetUrl(LATAM_COUNTRY_HERO_ASSETS['CO'].assetKey)
    ).toBe('/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp');

    expect(
      resolveHeroAssetUrl(LATAM_COUNTRY_HERO_ASSETS['PE'].assetKey)
    ).toBe('/assets/editorial/heroes/hero-latam-peru-machu-picchu.webp');

    expect(
      resolveHeroAssetUrl(LATAM_COUNTRY_HERO_ASSETS['EC'].assetKey)
    ).toBe('/assets/editorial/heroes/hero-latam-ecuador-volcan-nevado.webp');

    expect(
      resolveHeroAssetUrl(LATAM_COUNTRY_HERO_ASSETS['AR'].assetKey)
    ).toBe('/assets/editorial/heroes/hero-latam-argentina-patagonia.webp');
  });

  it('25. synchronizes active country chip, hero location, CTA, and text during AUTO rotation', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    const getActivePill = () => fixture.nativeElement.querySelector('.country-pill.topic-pill-active');
    const getCta = () => fixture.nativeElement.querySelector('.latam-hero-cta');
    const getLocation = () => fixture.nativeElement.querySelector('.colombia-location-chip');

    // Initial: CO
    expect(getActivePill()?.textContent).toContain('Colombia');
    expect(getCta()?.textContent).toContain('Descubrir Colombia');
    expect(component.activeCountry()?.displayName).toBe('Colombia');

    // 5s -> PE
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('PE');
    expect(getActivePill()?.textContent).toContain('Perú');
    expect(getCta()?.textContent).toContain('Descubrir Perú');
    expect(getLocation()?.textContent).toContain('Machu Picchu, Cusco');
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Perú.');

    // 10s -> EC
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('EC');
    expect(getActivePill()?.textContent).toContain('Ecuador');
    expect(getCta()?.textContent).toContain('Descubrir Ecuador');
    expect(getLocation()?.textContent).toContain('Andes ecuatorianos');
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Ecuador.');

    // 15s -> AR
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('AR');
    expect(getActivePill()?.textContent).toContain('Argentina');
    expect(getCta()?.textContent).toContain('Descubrir Argentina');
    expect(getLocation()?.textContent).toContain('Patagonia, Argentina');
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Argentina.');

    // 20s -> CO
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('CO');
    expect(getActivePill()?.textContent).toContain('Colombia');
    expect(getCta()?.textContent).toContain('Descubrir Colombia');
  });

  it('26. switches interactionMode to USER_CONTROLLED on clicking Perú, permanently stopping autoplay', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    const pills = fixture.nativeElement.querySelectorAll('.country-pill');
    expect(pills.length).toBe(4);

    // Click Perú
    (pills[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.activeCountryCode()).toBe('PE');
    expect(component.interactionMode()).toBe('USER_CONTROLLED');

    // Advancing timers should NOT rotate country anymore
    vi.advanceTimersByTime(21000);
    fixture.detectChanges();
    expect(component.activeCountryCode()).toBe('PE');
    expect(component.activeCountry()?.displayName).toBe('Perú');
  });

  it('27. PE, EC, and AR show NO Colombian readings, NO fake readings, hide topics, and show compact upcoming status without calling browsePlatformReadings', () => {
    fixture.detectChanges();
    // browsePlatformReadings was called once for Colombia on init
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(1);

    // 1. Perú
    component.selectCountry('PE');
    fixture.detectChanges();

    expect(component.realReadings().length).toBe(0);
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(1); // No new SOAP call!
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.topic-selector-group')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Perú.');

    // 2. Ecuador
    component.selectCountry('EC');
    fixture.detectChanges();

    expect(component.realReadings().length).toBe(0);
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(1); // No new SOAP call!
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.topic-selector-group')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Ecuador.');

    // 3. Argentina
    component.selectCountry('AR');
    fixture.detectChanges();

    expect(component.realReadings().length).toBe(0);
    expect(homeService.browsePlatformReadings).toHaveBeenCalledTimes(1); // No new SOAP call!
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.topic-selector-group')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Próximamente, nuevas historias de Argentina.');
  });

  it('28. switching from a preview country back to Colombia restores 15 real readings and Mitos y leyendas topic cleanly', () => {
    fixture.detectChanges();
    expect(component.realReadings().length).toBe(15);

    // Select Perú
    component.selectCountry('PE');
    fixture.detectChanges();
    expect(component.realReadings().length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card').length).toBe(0);

    // Select Colombia back
    component.selectCountry('CO');
    fixture.detectChanges();
    expect(component.realReadings().length).toBe(15);
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card').length).toBe(15);
    expect(fixture.nativeElement.querySelector('.topic-selector-group')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.topic-selector-group')?.textContent).toContain('Mitos y leyendas');
  });

  it('29. contextual CTA smooth-scrolls to #discoveryContent without navigating away from Home', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const scrollSpy = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;

    try {
      fixture.detectChanges();
      component.selectCountry('PE');
      fixture.detectChanges();

      const cta = fixture.nativeElement.querySelector('.latam-hero-cta') as HTMLButtonElement;
      expect(cta.textContent).toContain('Descubrir Perú');

      cta.click();
      expect(component.interactionMode()).toBe('USER_CONTROLLED');
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
      expect(navigateSpy).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('30. single-country custom overview rotates hero images when countries length is 1', () => {
    const singleCountryOverview: DiscoveryRegionOverview = {
      region: { key: 'latam', displayName: 'Latinoamérica', subtitle: 'Historias' },
      countries: [
        {
          countryCode: 'CO',
          displayName: 'Colombia',
          tagline: 'Tagline',
          description: 'Desc',
          displayOrder: 1,
          readingCount: 15,
          heroImages: [
            { assetKey: 'editorial/heroes/hero1.webp', location: 'Loc 1', displayOrder: 1 },
            { assetKey: 'editorial/heroes/hero2.webp', location: 'Loc 2', displayOrder: 2 },
          ],
          topics: [{ key: 'MYTHS', displayName: 'Mitos', displayOrder: 1, readingCount: 15 }],
        },
      ],
    };

    fixture.componentRef.setInput('customOverview', singleCountryOverview);
    vi.useFakeTimers();
    fixture.detectChanges();

    expect(component.countries().length).toBe(1);
    expect(component.activeHeroImageIndex()).toBe(0);
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeHeroImageIndex()).toBe(1);
    vi.advanceTimersByTime(COUNTRY_AUTOPLAY_MS);
    expect(component.activeHeroImageIndex()).toBe(0);
  });

  it('31. initializes from latinAmerica input with 0 extra SOAP calls, seeds cache, and respects defaultTopicKey', () => {
    const initialReadings = [
      mockReading({ readingId: 'seed-1', title: 'Seeded Story', countryCode: 'CO', discoveryTopic: 'MYTHS_AND_LEGENDS' }),
    ];
    const mockLatamData = {
      region: { key: 'latin-america', displayName: 'Latinoamérica', subtitle: 'Descubre nuestra región' },
      countries: [
        {
          countryCode: 'CO',
          displayName: 'Colombia',
          tagline: 'Tagline CO',
          description: 'Desc CO',
          displayOrder: 1,
          readingCount: 15,
          heroImages: [],
          topics: [
            { key: 'MYTHS_AND_LEGENDS', displayName: 'Mitos y leyendas', displayOrder: 1, readingCount: 15 },
            { key: 'REAL_STORIES', displayName: 'Historias reales', displayOrder: 2, readingCount: 5 },
          ],
        },
      ],
      defaultCountryCode: 'CO',
      defaultTopicKey: 'MYTHS_AND_LEGENDS',
      readings: initialReadings,
    };

    fixture.componentRef.setInput('latinAmerica', mockLatamData);
    fixture.detectChanges();

    // 0 extra SOAP calls!
    expect(homeService.getDiscoveryRegionOverview).not.toHaveBeenCalled();
    expect(homeService.browsePlatformReadings).not.toHaveBeenCalled();

    expect(component.activeCountryCode()).toBe('CO');
    expect(component.activeTopicKey()).toBe('MYTHS_AND_LEGENDS');
    expect(component.realReadings()).toHaveLength(1);
    expect(component.realReadings()[0].readingId).toBe('seed-1');

    // Ver todas link points to /collections/latin-america?country=CO
    const verTodasLink = fixture.nativeElement.querySelector('.latam-more-link') as HTMLAnchorElement;
    expect(verTodasLink).toBeTruthy();
    expect(verTodasLink.getAttribute('href')).toBe('/collections/latin-america?country=CO');
  });

  it('32. respects backend defaultTopicKey and does NOT force first topic if defaultTopicKey differs', () => {
    const initialReadings = [
      mockReading({ readingId: 'seed-hist', title: 'History Story', countryCode: 'CO', discoveryTopic: 'HISTORY_AND_MEMORY' }),
    ];
    const mockLatamData = {
      region: { key: 'latin-america', displayName: 'Latinoamérica', subtitle: 'Descubre nuestra región' },
      countries: [
        {
          countryCode: 'CO',
          displayName: 'Colombia',
          tagline: 'Tagline CO',
          description: 'Desc CO',
          displayOrder: 1,
          readingCount: 15,
          heroImages: [],
          topics: [
            { key: 'MYTHS_AND_LEGENDS', displayName: 'Mitos y leyendas', displayOrder: 1, readingCount: 10 },
            { key: 'HISTORY_AND_MEMORY', displayName: 'Historia', displayOrder: 2, readingCount: 5 },
          ],
        },
      ],
      defaultCountryCode: 'CO',
      defaultTopicKey: 'HISTORY_AND_MEMORY',
      readings: initialReadings,
    };

    fixture.componentRef.setInput('latinAmerica', mockLatamData);
    fixture.detectChanges();

    expect(component.activeCountryCode()).toBe('CO');
    expect(component.activeTopicKey()).toBe('HISTORY_AND_MEMORY');
    expect(homeService.browsePlatformReadings).not.toHaveBeenCalled();
  });
});
