import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecommendedPlatformReading } from '../../models/home.models';
import { HomeReadingCard } from './home-reading-card';

describe('HomeReadingCard', () => {
  let fixture: ComponentFixture<HomeReadingCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeReadingCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeReadingCard);
    fixture.componentRef.setInput('reading', reading());
    fixture.componentRef.setInput('primaryMetric', '14 conocidas · 9 en aprendizaje');
  });

  it('renders the shared editorial structure and keeps navigation intact', () => {
    fixture.componentRef.setInput('secondaryMetric', 'Compatibilidad 34%');
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('.recommendation-card') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/reading/reading-1');
    expect(anchor.querySelector('.reading-card-cover')).toBeTruthy();
    expect(anchor.querySelector('.reading-card-metadata')?.textContent).toContain('B1');
    expect(anchor.querySelector('.reading-card-title')?.textContent).toContain('A Window for the Workshop');
    expect(anchor.querySelector('.reading-card-primary-metric')?.textContent).toContain('14 conocidas · 9 en aprendizaje');
    expect(anchor.querySelector('.reading-card-secondary-metric')?.textContent).toContain('Compatibilidad 34%');
    expect(anchor.querySelector('.reading-card-cta')?.textContent).toContain('Abrir lectura');
  });

  it.each([
    ['IN_PROGRESS', 'En progreso', 'Continuar lectura →'],
    ['COMPLETED', '✓ Leída', 'Releer →'],
  ] as const)('keeps progress and CTA in the same slots for %s', (progressStatus, progress, cta) => {
    fixture.componentRef.setInput('reading', reading({ progressStatus }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reading-card-progress').textContent).toContain(progress);
    expect(fixture.nativeElement.querySelector('.reading-card-cta').textContent).toContain(cta);
  });

  it('reserves the secondary slot without exposing empty content to accessibility APIs', () => {
    fixture.detectChanges();

    const secondary = fixture.nativeElement.querySelector('.reading-card-secondary-metric') as HTMLElement;
    expect(secondary.textContent).toBe('');
    expect(secondary.getAttribute('aria-hidden')).toBe('true');
    expect(secondary.classList.contains('reading-card-secondary-metric-empty')).toBe(true);
  });

  it('uses the catalog cover and replaces a failed image with the shared fallback', () => {
    fixture.componentRef.setInput('reading', reading({ coverKey: 'the-camera-on-platform-three' }));
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/assets/reading-covers/the-camera-on-platform-three.webp');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cover-fallback')).toBeTruthy();
  });

  it('renders reveal details through the same structure and supports keyboard focus', () => {
    fixture.componentRef.setInput('revealMetrics', ['14 palabras conocidas', '9 palabras que estás aprendiendo']);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('.recommendation-card') as HTMLAnchorElement;
    anchor.focus();
    expect(document.activeElement).toBe(anchor);
    expect(anchor.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('14 palabras conocidas');
    expect(anchor.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('9 palabras que estás aprendiendo');
  });

  it.each(['light', 'dark'])('uses semantic card classes in %s mode', (theme) => {
    document.documentElement.dataset['theme'] = theme;
    fixture.detectChanges();

    const metric = fixture.nativeElement.querySelector('.reading-card-primary-metric') as HTMLElement;
    expect(metric.className).not.toContain('text-[#');
    expect(metric.textContent).toContain('14 conocidas');
  });

  function reading(overrides: Partial<RecommendedPlatformReading> = {}): RecommendedPlatformReading {
    return {
      readingId: 'reading-1',
      title: 'A Window for the Workshop',
      language: 'en',
      editorialLevel: 'B1',
      category: 'Daily Life',
      createdAt: null,
      uniqueWords: 100,
      knownWords: 14,
      learningWords: 9,
      explicitNewWords: 10,
      ignoredWords: 2,
      unclassifiedWords: 65,
      vocabularyFitPercentage: 34,
      classificationConfidencePercentage: 25,
      progressStatus: null,
      coverKey: null,
      ...overrides,
    };
  }
});
