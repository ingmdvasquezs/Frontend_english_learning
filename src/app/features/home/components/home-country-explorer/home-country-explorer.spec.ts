import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeCountryExplorer, resolveCountryHeroUrl } from './home-country-explorer';
import { DiscoveryCountrySummary } from '../../models/home.models';

describe('HomeCountryExplorer', () => {
  let fixture: ComponentFixture<HomeCountryExplorer>;
  let component: HomeCountryExplorer;

  const mockCountries: DiscoveryCountrySummary[] = [
    {
      countryCode: 'CO',
      displayName: 'Colombia',
      tagline: 'Tierra de café y leyendas',
      description: 'Historias de Colombia',
      displayOrder: 1,
      readingCount: 15,
      heroImages: [{ assetKey: 'editorial/heroes/hero-latam-colombia-valle-de-cocora.webp', displayOrder: 1, alt: 'Valle de Cocora' }],
      topics: [],
    },
    {
      countryCode: 'MX',
      displayName: 'México',
      tagline: 'Cultura ancestral y color',
      description: 'Historias de México',
      displayOrder: 2,
      readingCount: 5,
      heroImages: [{ assetKey: 'editorial/heroes/mexico/hero-mexico-popocatepetl.webp', displayOrder: 1, alt: 'México' }],
      topics: [],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeCountryExplorer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeCountryExplorer);
    component = fixture.componentInstance;
  });

  it('renders section title, subtitle and explore anchor IDs', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector('#explore-countries-heading');
    expect(title).toBeTruthy();
    expect(title?.textContent?.trim()).toBe('Explora historias por país');

    const sectionWithAnchor = root.querySelector('#explore-stories-heading');
    expect(sectionWithAnchor).toBeTruthy();
  });

  it('rail starts at position 0 with first card completely visible', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const railEl = component.countriesRailRef?.nativeElement;
    expect(railEl).toBeTruthy();
    expect(railEl!.scrollLeft).toBe(0);
    expect(component.railAtStart()).toBe(true);

    const firstCard = fixture.nativeElement.querySelector('.country-card') as HTMLElement;
    expect(firstCard).toBeTruthy();
    expect(firstCard.textContent).toContain('Colombia');
    expect(firstCard.textContent).toContain('15 lecturas');
  });

  it('resets rail to position 0 and preserves visibility when data reloads asynchronously', async () => {
    // Initial render with empty countries
    fixture.componentRef.setInput('countries', []);
    fixture.detectChanges();

    const railEl = component.countriesRailRef?.nativeElement;
    expect(railEl).toBeTruthy();

    // Simulate prior scroll offset
    railEl!.scrollLeft = 320;
    expect(railEl!.scrollLeft).toBe(320);

    // Update with loaded data
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(railEl!.scrollLeft).toBe(0);
    expect(component.railAtStart()).toBe(true);
    const cards = fixture.nativeElement.querySelectorAll('.country-card');
    expect(cards[0].textContent).toContain('Colombia');
  });

  it('renders real counts for available backend countries without inventing counts', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const availableCards = root.querySelectorAll('.country-card-available');
    expect(availableCards.length).toBe(2);

    // Colombia
    const colombiaCard = availableCards[0];
    expect(colombiaCard.textContent).toContain('Colombia');
    expect(colombiaCard.textContent).toContain('15 lecturas');
    expect(colombiaCard.getAttribute('href')).toContain('/collections/latin-america?country=CO');

    // Mexico
    const mexicoCard = availableCards[1];
    expect(mexicoCard.textContent).toContain('México');
    expect(mexicoCard.textContent).toContain('5 lecturas');
    expect(mexicoCard.getAttribute('href')).toContain('/collections/latin-america?country=MX');
  });

  it('renders upcoming countries with Próximamente badge and zero fabricated readings', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const upcomingCards = root.querySelectorAll('.country-card-upcoming');
    expect(upcomingCards.length).toBeGreaterThanOrEqual(4); // Peru, Ecuador, Argentina, Chile

    const cardTexts = Array.from(upcomingCards).map((c) => c.textContent || '');
    expect(cardTexts.some((t) => t.includes('Perú'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('Chile'))).toBe(true);

    for (const text of cardTexts) {
      expect(text).toContain('Próximamente');
      expect(text).not.toContain('lecturas');
    }
  });

  it('next button advances scroll position and previous button scrolls back left', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const railEl = component.countriesRailRef?.nativeElement;
    expect(railEl).toBeTruthy();

    Object.defineProperty(railEl, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(railEl, 'scrollWidth', { configurable: true, value: 1200 });

    const cards = Array.from(railEl!.querySelectorAll<HTMLElement>('.country-card'));
    cards.forEach((card, i) => {
      Object.defineProperty(card, 'offsetLeft', { configurable: true, value: i * 220 });
      Object.defineProperty(card, 'offsetWidth', { configurable: true, value: 200 });
    });

    const scrollToSpy = vi.fn((opts?: ScrollToOptions | number, _y?: number) => {
      if (typeof opts === 'object' && opts?.left !== undefined) {
        railEl!.scrollLeft = opts.left;
      }
    });
    (railEl as any).scrollTo = scrollToSpy;

    // Advance forward
    component.scrollRail('next');
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(railEl!.scrollLeft).toBeGreaterThan(0);

    // Scroll backward
    const advancedPosition = railEl!.scrollLeft;
    component.scrollRail('previous');
    expect(railEl!.scrollLeft).toBeLessThan(advancedPosition);
  });

  it('previous button is disabled at start and next button is disabled at end', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    component.railHasOverflow.set(true);
    component.railAtStart.set(true);
    component.railAtEnd.set(false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const prevBtn = root.querySelector('button[aria-label="Ver países anteriores"]') as HTMLButtonElement;
    const nextBtn = root.querySelector('button[aria-label="Ver países siguientes"]') as HTMLButtonElement;

    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    // Simulate at end
    component.railAtStart.set(false);
    component.railAtEnd.set(true);
    fixture.detectChanges();

    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
  });

  it('renders latam-more-link in header pointing to collections with defaultCountryCode', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.componentRef.setInput('defaultCountryCode', 'CO');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.latam-more-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Ver todas');
    expect(link.getAttribute('href')).toContain('/collections/latin-america?country=CO');
  });

  it('renders MX with valid asset URL when provided', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const mexicoImg = root.querySelector('img[alt="Paisaje de México"]') as HTMLImageElement;
    expect(mexicoImg).toBeTruthy();
    expect(mexicoImg.getAttribute('src')).toBe('/assets/editorial/heroes/mexico/hero-mexico-popocatepetl.webp');
    expect(component.hasImageFailed('MX')).toBe(false);
  });

  it('transitions MX to editorial fallback on image error, eliminating broken img and alt text', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const mexicoImg = root.querySelector('img[alt="Paisaje de México"]') as HTMLImageElement;
    expect(mexicoImg).toBeTruthy();

    // Simulate browser image load failure (404)
    mexicoImg.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(component.hasImageFailed('MX')).toBe(true);

    // Broken image element with alt text MUST NOT exist in DOM anymore
    const brokenImg = root.querySelector('img[alt="Paisaje de México"]');
    expect(brokenImg).toBeNull();

    // Elegant editorial fallback is rendered
    const fallbackBg = root.querySelector('.country-card-fallback-bg');
    expect(fallbackBg).toBeTruthy();
    const monogram = root.querySelector('.country-fallback-monogram');
    expect(monogram).toBeTruthy();
    expect(monogram?.textContent?.trim()).toBe('MX');

    // Card structure, title, badge, and navigation remain 100% intact
    const mexicoCard = Array.from(root.querySelectorAll('.country-card')).find((c) =>
      c.textContent?.includes('México')
    );
    expect(mexicoCard).toBeTruthy();
    expect(mexicoCard?.textContent).toContain('México');
    expect(mexicoCard?.textContent).toContain('5 lecturas');
    expect(mexicoCard?.getAttribute('href')).toContain('/collections/latin-america?country=MX');
  });

  it('renders editorial fallback directly when country has empty or missing heroImage without creating img', () => {
    const countriesWithoutImage: DiscoveryCountrySummary[] = [
      {
        countryCode: 'MX',
        displayName: 'México',
        tagline: 'Cultura ancestral',
        description: 'Historias de México',
        displayOrder: 1,
        readingCount: 8,
        heroImages: [],
        topics: [],
      },
    ];

    fixture.componentRef.setInput('countries', countriesWithoutImage);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const img = root.querySelector('img[alt="Paisaje de México"]');
    expect(img).toBeNull();

    const fallbackBg = root.querySelector('.country-card-fallback-bg');
    expect(fallbackBg).toBeTruthy();
    const monogram = root.querySelector('.country-fallback-monogram');
    expect(monogram?.textContent?.trim()).toBe('MX');
  });

  it('keeps other countries (CO, PE, EC, AR, CL) rendering normally without disturbance', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    // Trigger error on Mexico only
    component.onImageError('MX');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    // Colombia still renders its valid photo
    const colombiaImg = root.querySelector('img[alt="Paisaje de Colombia"]') as HTMLImageElement;
    expect(colombiaImg).toBeTruthy();
    expect(colombiaImg.getAttribute('src')).toBe('/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp');

    // Upcoming countries (PE, EC, AR, CL) still render
    const upcomingCards = root.querySelectorAll('.country-card-upcoming');
    expect(upcomingCards.length).toBeGreaterThanOrEqual(4);
    const cardTexts = Array.from(upcomingCards).map((c) => c.textContent || '');
    expect(cardTexts.some((t) => t.includes('Perú'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('Ecuador'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('Argentina'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('Chile'))).toBe(true);
  });

  describe('resolveCountryHeroUrl', () => {
    it('preserves absolute http and https URLs for CloudFront and S3 CDNs', () => {
      const cdnUrl = 'https://d1wm4p27h1vrkl.cloudfront.net/editorial/heroes/mexico.webp';
      expect(resolveCountryHeroUrl(cdnUrl)).toBe(cdnUrl);
      expect(resolveCountryHeroUrl('http://example.com/hero.webp')).toBe('http://example.com/hero.webp');
    });

    it('resolves relative asset paths to /assets/', () => {
      expect(resolveCountryHeroUrl('editorial/heroes/hero.webp')).toBe('/assets/editorial/heroes/hero.webp');
      expect(resolveCountryHeroUrl('/assets/editorial/heroes/hero.webp')).toBe('/assets/editorial/heroes/hero.webp');
      expect(resolveCountryHeroUrl('assets/editorial/heroes/hero.webp')).toBe('/assets/editorial/heroes/hero.webp');
    });

    it('returns null for null, undefined, or empty values', () => {
      expect(resolveCountryHeroUrl(null)).toBeNull();
      expect(resolveCountryHeroUrl(undefined)).toBeNull();
      expect(resolveCountryHeroUrl('')).toBeNull();
      expect(resolveCountryHeroUrl('   ')).toBeNull();
    });
  });
});
