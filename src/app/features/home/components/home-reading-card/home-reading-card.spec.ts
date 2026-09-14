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
  });

  it('renders the shared editorial structure and keeps navigation intact', () => {
    fixture.componentRef.setInput('secondaryMetric', '12 min');
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('.recommendation-card') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/reading/reading-1');
    expect(anchor.querySelector('.reading-card-cover')).toBeTruthy();
    expect(anchor.querySelector('.reading-card-metadata')?.textContent).toContain('B1');
    expect(anchor.querySelector('.reading-card-title')?.textContent).toContain('A Window for the Workshop');
    expect(anchor.querySelector('.reading-card-primary-metric')?.textContent).toContain('34% vocab fit');
    expect(anchor.querySelector('.reading-card-secondary-metric')?.textContent).toContain('12 min');
    expect(anchor.querySelector('.reading-card-cta')?.textContent).toContain('Open reading');
  });

  it.each([
    ['IN_PROGRESS', 'In progress', 'Continue reading →'],
    ['COMPLETED', '✓ Read', 'Re-read →'],
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
    fixture.componentRef.setInput('revealMetrics', ['14 Known words', '9 Learning words', '20 Words to learn']);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('.recommendation-card') as HTMLAnchorElement;
    anchor.focus();
    expect(document.activeElement).toBe(anchor);
    expect(anchor.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('14 Known words');
    expect(anchor.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('9 Learning words');
    expect(anchor.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('20 Words to learn');
  });

  it.each(['light', 'dark'])('uses semantic card classes in %s mode', (theme) => {
    document.documentElement.dataset['theme'] = theme;
    fixture.detectChanges();

    const metric = fixture.nativeElement.querySelector('.reading-card-primary-metric') as HTMLElement;
    expect(metric.className).not.toContain('text-[#');
    expect(metric.textContent).toContain('34% vocab fit');
  });

  it('does NOT render reason in the resting state body, but renders it exclusively in the reveal when reasonCode is present', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'HIGH_VOCABULARY_MATCH' })
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reading-card-reason')).toBeNull();

    const revealReason = fixture.nativeElement.querySelector('.reading-card-reason-reveal');
    expect(revealReason).toBeTruthy();
    expect(revealReason.textContent).toContain(
      'Gran parte del vocabulario de esta lectura ya te resulta familiar.'
    );
    expect(fixture.nativeElement.textContent).not.toContain('HIGH_VOCABULARY_MATCH');
  });

  it('omits reason from reveal when reasonCode is null without leaving raw code or breaking layout', () => {
    fixture.componentRef.setInput('reading', reading({ reasonCode: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reading-card-reason')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reading-card-reason-reveal')).toBeNull();
  });

  // A, B, C: DISCOVERY + fit 13 renders "13% vocab fit", does NOT show "Discover", and uses discovery/amber class
  it('renders "13% vocab fit" in resting state with amber discovery class for DISCOVERY and never shows "Discover"', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'DISCOVERY', vocabularyFitPercentage: 13 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('13% vocab fit');
    expect(indicator.querySelector('.fit-signal-icon')).toBeTruthy();

    // B: NO Discover anywhere
    expect(fixture.nativeElement.textContent).not.toContain('Discover');
    expect(fixture.nativeElement.querySelector('.reading-card-discovery-indicator')).toBeNull();

    // C: fit indicator uses semantic discovery / amber class
    expect(indicator.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-normal')).toBe(false);
  });

  // D, E: NON-DISCOVERY + fit 76 renders "76% vocab fit" and uses normal/green class
  it('renders "76% vocab fit" in resting state with green/normal class for NON-DISCOVERY', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'HIGH_VOCABULARY_MATCH', vocabularyFitPercentage: 76 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('76% vocab fit');
    expect(indicator.querySelector('.fit-signal-icon')).toBeTruthy();

    // E: fit indicator uses normal/green class
    expect(indicator.classList.contains('reading-card-fit-normal')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-green')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-discovery')).toBe(false);
    expect(indicator.classList.contains('reading-card-fit-amber')).toBe(false);
  });

  // F: DISCOVERY + fit 0 renders "0% vocab fit" in amber
  it('renders "0% vocab fit" in amber when DISCOVERY has vocabularyFitPercentage of 0', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'DISCOVERY', vocabularyFitPercentage: 0 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('0% vocab fit');
    expect(indicator.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Discover');
  });

  // G, H: DISCOVERY hover renders Spanish pedagogical explanation and real metrics breakdown
  it('DISCOVERY hover renders Spanish explanation and English metrics breakdown when data exists', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({
        reasonCode: 'DISCOVERY',
        vocabularyFitPercentage: 13,
        knownWords: 30,
        learningWords: 10,
        explicitNewWords: 4,
        unclassifiedWords: 250,
      })
    );
    fixture.detectChanges();

    const reveal = fixture.nativeElement.querySelector('.recommendation-metrics-reveal');
    expect(reveal).toBeTruthy();

    // G: Spanish pedagogical explanation
    expect(reveal.querySelector('.reading-card-reason-reveal')?.textContent).toContain(
      'Estamos conociendo tu vocabulario para mejorar tus recomendaciones.'
    );

    // H: Vocabulary fit / Compatibility / Known words / Learning words / Words to learn in English
    expect(reveal.textContent).toContain('Compatibility 13%');
    expect(reveal.textContent).toContain('30 Known words');
    expect(reveal.textContent).toContain('10 Learning words');
    expect(reveal.textContent).toContain('254 Words to learn');
    expect(reveal.textContent).toContain('Open reading →');
    expect(fixture.nativeElement.textContent).not.toContain('DISCOVERY');
  });

  // I: Collections regression test
  it('preserves signal icon + real vocab fit in green and does NOT show Discover for collection cards with mature confidence', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: null, vocabularyFitPercentage: 88, classificationConfidencePercentage: 85 })
    );
    fixture.componentRef.setInput('primaryMetric', 'Compatibility 88%');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reading-card-discovery-indicator')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Discover');

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('88% vocab fit');
    expect(indicator?.classList.contains('reading-card-fit-normal')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-green')).toBe(true);
    expect(indicator?.classList.contains('vocab-fit-indicator--mature')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-discovery')).toBe(false);
    expect(indicator?.querySelector('.fit-signal-icon')).toBeTruthy();
  });

  it('renders low numeric fit (13%) in GREEN when evidence is mature (HIGH_VOCABULARY_MATCH)', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'HIGH_VOCABULARY_MATCH', vocabularyFitPercentage: 13 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('13% vocab fit');
    expect(indicator?.classList.contains('reading-card-fit-normal')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-green')).toBe(true);
    expect(indicator?.classList.contains('vocab-fit-indicator--mature')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-discovery')).toBe(false);
  });

  it('renders high numeric fit (76%) in AMBER when evidence is discovery (DISCOVERY)', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'DISCOVERY', vocabularyFitPercentage: 76 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('76% vocab fit');
    expect(indicator?.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(indicator?.classList.contains('vocab-fit-indicator--discovery')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-green')).toBe(false);
  });

  it('resolves collection card tone based on classificationConfidencePercentage (amber when < 40, green when >= 40)', () => {
    // Amber when confidence < 40
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: null, vocabularyFitPercentage: 35, classificationConfidencePercentage: 30 })
    );
    fixture.detectChanges();
    let indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator?.classList.contains('vocab-fit-indicator--discovery')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-amber')).toBe(true);

    // Green when confidence >= 40
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: null, vocabularyFitPercentage: 35, classificationConfidencePercentage: 40 })
    );
    fixture.detectChanges();
    indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator?.classList.contains('vocab-fit-indicator--mature')).toBe(true);
    expect(indicator?.classList.contains('reading-card-fit-green')).toBe(true);
  });

  it('renders neutral unknown tone when both reasonCode and confidence are absent', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: null, vocabularyFitPercentage: 50, classificationConfidencePercentage: null as unknown as number })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('50% vocab fit');
    expect(indicator?.classList.contains('vocab-fit-indicator--unknown')).toBe(true);
    expect(indicator?.classList.contains('vocab-fit-indicator--discovery')).toBe(false);
    expect(indicator?.classList.contains('vocab-fit-indicator--mature')).toBe(false);
  });

  it('sets accessibility attributes aria-label and title based on evidence tone', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'DISCOVERY', vocabularyFitPercentage: 20 })
    );
    fixture.detectChanges();

    let indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator?.getAttribute('aria-label')).toBe('Vocabulary fit estimate — limited evidence');
    expect(indicator?.getAttribute('title')).toBe('Vocabulary fit estimate — limited evidence');

    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'HIGH_VOCABULARY_MATCH', vocabularyFitPercentage: 80 })
    );
    fixture.detectChanges();

    indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator?.getAttribute('aria-label')).toBe('Vocabulary fit');
    expect(indicator?.getAttribute('title')).toBe('Vocabulary fit');
  });

  it.each([
    'HIGH_VOCABULARY_MATCH',
    'PRACTICE_VOCABULARY',
    'BALANCED_CHALLENGE',
    'MORE_CHALLENGING',
    'CONTINUE_READING',
    null,
  ] as const)('keeps fit indicator in resting state when reasonCode is %s', (reasonCode) => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode, vocabularyFitPercentage: 85 })
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.reading-card-summary .reading-card-primary-metric')?.textContent
    ).toContain('85% vocab fit');
  });

  it('renders short editorial description when provided and omits .reading-card-desc when absent', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reading-card-desc')).toBeNull();

    fixture.componentRef.setInput('description', 'A craftsman reflects on morning light through oak windows.');
    fixture.detectChanges();
    const descEl = fixture.nativeElement.querySelector('.reading-card-desc');
    expect(descEl).toBeTruthy();
    expect(descEl.textContent).toContain('A craftsman reflects on morning light');
  });

  it('maintains the cover container intact on left while reveal overlay resides in the right content body', () => {
    fixture.componentRef.setInput('revealMetrics', ['14 Known words', '9 Learning words']);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.recommendation-card') as HTMLElement;
    const cover = card.querySelector('.reading-card-cover') as HTMLElement;
    const body = card.querySelector('.recommendation-card-body') as HTMLElement;
    const reveal = body.querySelector('.recommendation-metrics-reveal') as HTMLElement;

    expect(cover).toBeTruthy();
    expect(body).toBeTruthy();
    expect(reveal).toBeTruthy();
    expect(cover.contains(reveal)).toBe(false);
    expect(body.contains(reveal)).toBe(true);
  });

  it('renders signal icon and "76% vocab fit" in resting state for non-DISCOVERY with fit, and never renders progress track or fill', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ reasonCode: 'HIGH_VOCABULARY_MATCH', vocabularyFitPercentage: 76 })
    );
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.reading-card-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('76% vocab fit');
    expect(indicator.querySelector('.fit-signal-icon')).toBeTruthy();

    // Confirm track and fill do not exist anywhere in DOM
    expect(fixture.nativeElement.querySelector('.reading-card-fit-track')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reading-card-fit-fill')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reading-card-fit')).toBeNull();
  });

  it('renders English breakdown labels in the hover reveal (Known words, Learning words, Words to learn)', () => {
    fixture.componentRef.setInput(
      'reading',
      reading({ knownWords: 142, learningWords: 12, explicitNewWords: 4, unclassifiedWords: 200 })
    );
    fixture.componentRef.setInput('revealMetrics', []);
    fixture.detectChanges();

    const reveal = fixture.nativeElement.querySelector('.recommendation-metrics-reveal');
    expect(reveal.textContent).toContain('Known words');
    expect(reveal.textContent).toContain('Learning words');
    expect(reveal.textContent).toContain('Words to learn');
  });

  it.each([
    [null, 'Open reading →'],
    ['IN_PROGRESS', 'Continue reading →'],
    ['COMPLETED', 'Re-read →'],
  ] as const)('renders functional English CTA %s for progressStatus %s', (progressStatus, expectedCta) => {
    fixture.componentRef.setInput('reading', reading({ progressStatus }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reading-card-cta').textContent).toContain(expectedCta);
    expect(fixture.nativeElement.querySelector('.reading-card-reveal-cta').textContent).toContain(expectedCta);
  });

  it('omits fit indicator when vocabularyFitPercentage is null', () => {
    fixture.componentRef.setInput('reading', reading({ vocabularyFitPercentage: null as unknown as number }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reading-card-fit-indicator')).toBeNull();
  });

  it('displays secondary metric when provided without inventing duration', () => {
    fixture.componentRef.setInput('secondaryMetric', '12 min');
    fixture.detectChanges();

    const secondary = fixture.nativeElement.querySelector('.reading-card-secondary-metric');
    expect(secondary?.textContent).toBe('12 min');
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
