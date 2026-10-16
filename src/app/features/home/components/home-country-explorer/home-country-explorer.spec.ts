import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeCountryExplorer } from './home-country-explorer';
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
      heroImages: [{ assetKey: 'editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp', displayOrder: 1, alt: 'México' }],
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

    // Ensure none of the upcoming cards have fake reading count labels like "5 lecturas"
    for (const text of cardTexts) {
      expect(text).toContain('Próximamente');
      expect(text).not.toContain('lecturas');
    }
  });

  it('handles horizontal rail navigation clicks when overflow exists', () => {
    fixture.componentRef.setInput('countries', mockCountries);
    fixture.detectChanges();

    component.railHasOverflow.set(true);
    component.railAtStart.set(false);
    component.railAtEnd.set(false);
    fixture.detectChanges();

    const railEl = component.countriesRailRef?.nativeElement;
    if (railEl) {
      const scrollBySpy = vi.fn();
      railEl.scrollBy = scrollBySpy;
      component.scrollRail('next');
      expect(scrollBySpy).toHaveBeenCalled();
    }
  });
});
