import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EditorialUniverse } from './editorial-universe';
import { HomeService } from '../../services/home';
import { RecommendedPlatformReading } from '../../models/home.models';

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
    ...overrides,
  };
}

const FIVE_REAL_READINGS: RecommendedPlatformReading[] = [
  mockReading({
    readingId: 'reading-mohan',
    title: 'The Mohán and the Spring of Water',
    coverKey: 'mohan-pasuncha',
    editorialLevel: 'B1',
    description: 'A woman from Pasuncha shares her last tobacco with a mysterious old traveler.',
    progressStatus: null,
  }),
  mockReading({
    readingId: 'reading-madremonte',
    title: 'The Madremonte',
    coverKey: 'madremonte-colombia',
    editorialLevel: 'B2',
    description: 'A powerful forest spirit guards rivers, mountains and rural boundaries.',
    progressStatus: 'IN_PROGRESS',
  }),
  mockReading({
    readingId: 'reading-patasola',
    title: 'The Patasola',
    coverKey: 'patasola-colombia',
    editorialLevel: 'B2',
    description: 'A beautiful apparition lures men deep into the forest.',
    progressStatus: 'COMPLETED',
  }),
  mockReading({
    readingId: 'reading-llorona',
    title: 'La Llorona — The Weeping Woman',
    coverKey: 'la-llorona-colombia',
    editorialLevel: 'B2',
    description: 'A grieving spirit wanders rivers and lonely paths.',
    progressStatus: null,
  }),
  mockReading({
    readingId: 'reading-candileja',
    title: 'The Candileja',
    coverKey: 'candileja-llanos',
    editorialLevel: 'B1',
    description: 'An overindulgent grandmother and her two disrespectful grandsons.',
    progressStatus: null,
  }),
];

describe('EditorialUniverse', () => {
  let fixture: ComponentFixture<EditorialUniverse>;
  let component: EditorialUniverse;
  let homeService: {
    listCollectionReadings: ReturnType<typeof vi.fn>;
    parseCollectionReadings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    homeService = {
      listCollectionReadings: vi.fn().mockReturnValue(of('<response/>')),
      parseCollectionReadings: vi.fn().mockReturnValue({
        page: 0,
        size: 10,
        totalElements: 5,
        readings: FIVE_REAL_READINGS,
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

  it('renders the Colombia featured banner with titles and quote', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Universo destacado');
    expect(text).toContain('Colombia');
    expect(text).toContain('Personas extraordinarias');
    expect(text).toContain('Muchas historias. Un lugar increíble.');
  });

  it('renders all subtopics without fake counts', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mitos y leyendas');
    expect(text).toContain('Historias reales');
    expect(text).toContain('Historia y memoria');
    expect(text).toContain('Cultura y tradiciones');
    expect(text).toContain('Naturaleza y lugares');

    expect(text).not.toContain('4 historias');
    expect(text).not.toContain('6 historias');
  });

  it('invokes listCollectionReadings with "colombian-myths-legends" on initialization', () => {
    fixture.detectChanges();
    expect(homeService.listCollectionReadings).toHaveBeenCalledWith('colombian-myths-legends', 0, 20);
    expect(homeService.parseCollectionReadings).toHaveBeenCalledWith('<response/>');
  });

  it('preserves backend order when rendering the 5 real collection cards', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(5);

    const titles = Array.from(cards).map(
      (c) => (c as HTMLElement).querySelector('.story-title')?.textContent?.trim()
    );
    expect(titles).toEqual([
      'The Mohán and the Spring of Water',
      'The Madremonte',
      'The Patasola',
      'La Llorona — The Weeping Woman',
      'The Candileja',
    ]);
  });

  it('renders real shortDescription and resolves coverKey correctly', () => {
    fixture.detectChanges();
    const firstCard = fixture.nativeElement.querySelector('.colombia-story-card');
    expect(firstCard.querySelector('.story-summary')?.textContent).toContain(
      'A woman from Pasuncha shares her last tobacco with a mysterious old traveler.'
    );

    const img = firstCard.querySelector('.story-cover-img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('mohan-pasuncha.webp');
  });

  it('renders correct lifecycle CTA labels for NOT_STARTED, IN_PROGRESS, and COMPLETED', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');

    // 1st: NOT_STARTED
    expect(cards[0].querySelector('.story-cta')?.textContent?.trim()).toBe('Open →');
    // 2nd: IN_PROGRESS
    expect(cards[1].querySelector('.story-cta')?.textContent?.trim()).toBe('Continue →');
    // 3rd: COMPLETED
    expect(cards[2].querySelector('.story-cta')?.textContent?.trim()).toBe('Re-read →');
  });

  it('renders a clean empty state when backend returns no readings without fake cards', () => {
    homeService.parseCollectionReadings.mockReturnValue({
      page: 0,
      size: 10,
      totalElements: 0,
      readings: [],
    });
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No hay historias disponibles en esta colección.');
    expect(fixture.nativeElement.textContent).not.toContain('The Sombrerón at Night');
  });

  it('renders an error state with retry button on failure without falling back to fake cards', () => {
    homeService.listCollectionReadings.mockReturnValue(throwError(() => new Error('SOAP network error')));
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar las historias.');
    expect(fixture.nativeElement.textContent).not.toContain('The Sombrerón at Night');

    const retryBtn = fixture.nativeElement.querySelector('.universe-retry-btn');
    expect(retryBtn).toBeTruthy();

    // Now mock recovery and click retry
    homeService.listCollectionReadings.mockReturnValue(of('<recovered/>'));
    retryBtn.click();
    fixture.detectChanges();

    expect(homeService.listCollectionReadings).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card')).toHaveLength(5);
  });

  it('displays upcoming editorial state for non-collection topics without fake readings', () => {
    fixture.detectChanges();
    // Click "Historias reales"
    const pillButtons = fixture.nativeElement.querySelectorAll('.topic-pill');
    const realStoriesBtn = Array.from(pillButtons).find((btn) =>
      (btn as HTMLElement).textContent?.includes('Historias reales')
    ) as HTMLButtonElement;
    expect(realStoriesBtn).toBeTruthy();

    realStoriesBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Próximamente: nuevas historias de Historias reales');
    expect(fixture.nativeElement.textContent).not.toContain('The Legend of La Llorona');
  });

  it('caches collection results and does not refetch when switching between topics', () => {
    fixture.detectChanges();
    expect(homeService.listCollectionReadings).toHaveBeenCalledOnce();

    // Switch to upcoming topic
    component.selectTopic('history');
    fixture.detectChanges();
    expect(component.selectedTopicId()).toBe('history');
    expect(homeService.listCollectionReadings).toHaveBeenCalledOnce();

    // Switch back to myths
    component.selectTopic('myths');
    fixture.detectChanges();
    expect(component.selectedTopicId()).toBe('myths');
    expect(homeService.listCollectionReadings).toHaveBeenCalledOnce(); // No extra call!
    expect(fixture.nativeElement.querySelectorAll('.colombia-story-card')).toHaveLength(5);
  });

  it('shows a notice when clicking the Explorar Colombia CTA', () => {
    fixture.detectChanges();
    const cta = fixture.nativeElement.querySelector('.colombia-cta') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    expect(cta.textContent).toContain('Explorar Colombia');

    expect(fixture.nativeElement.querySelector('.preview-notice-toast')).toBeNull();
    cta.click();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.preview-notice-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('colección completa de Colombia');
  });

  it('renders vocab fit indicator on each real collection card', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(5);

    // Each card that has a real percentage should show vocab-fit-indicator
    for (const card of Array.from(cards)) {
      const fitEl = (card as HTMLElement).querySelector('.vocab-fit-indicator');
      // mockReading sets vocabularyFitPercentage: 30 for all — indicator must be present
      expect(fitEl).toBeTruthy();
      expect((fitEl as HTMLElement).textContent).toContain('30% vocab fit');
    }
  });

  it('vocab fit uses reasonCode / confidence semantics — DISCOVERY => amber, not green', () => {
    // Default mock has reasonCode: 'DISCOVERY' and classificationConfidencePercentage: 0
    fixture.detectChanges();
    const firstCard = fixture.nativeElement.querySelector('.colombia-story-card');
    const fitEl = firstCard.querySelector('.vocab-fit-indicator') as HTMLElement;
    expect(fitEl).toBeTruthy();
    // discovery class should be applied, not mature
    expect(fitEl.classList.contains('vocab-fit-indicator--discovery')).toBe(true);
    expect(fitEl.classList.contains('vocab-fit-indicator--mature')).toBe(false);
  });

  it('does not render vocab fit indicator when vocabularyFitPercentage is not finite', () => {
    homeService.parseCollectionReadings.mockReturnValue({
      page: 0, size: 10, totalElements: 1,
      readings: [mockReading({ vocabularyFitPercentage: NaN, reasonCode: null, classificationConfidencePercentage: 0 })],
    });
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.colombia-story-card');
    // percentage is NaN → indicator renders nothing (conditional @if inside vocabulary-fit-indicator)
    const fitEl = card?.querySelector('.vocab-fit-indicator');
    expect(fitEl).toBeNull();
  });

  it('renders reading.category in metadata and not selectedTopic name', () => {
    fixture.detectChanges();
    const firstCard = fixture.nativeElement.querySelector('.colombia-story-card');
    const categoryEl = firstCard.querySelector('.story-category');
    expect(categoryEl).toBeTruthy();
    expect(categoryEl.textContent?.trim()).toBe('Culture, Arts & Fiction');
    expect(categoryEl.textContent).not.toBe('Mitos y leyendas');
  });

  it('renders an aligned horizontal footer containing fit indicator and CTA anchored at the base', () => {
    fixture.detectChanges();
    const firstCard = fixture.nativeElement.querySelector('.colombia-story-card');
    const footer = firstCard.querySelector('.story-footer') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(footer.querySelector('.vocab-fit-indicator')).toBeTruthy();
    expect(footer.querySelector('.story-cta')).toBeTruthy();
    expect(footer.textContent).toContain('30% vocab fit');
    expect(footer.textContent).toContain('Open →');
  });

  it('renders exactly 5 real collection cards adopting shared reading card structure without fake collections', () => {
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('.colombia-stories-grid');
    expect(grid).toBeTruthy();
    const cards = grid.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(5);

    for (const card of Array.from(cards) as HTMLElement[]) {
      expect(card.querySelector('.reading-card-cover')).toBeTruthy();
      expect(card.querySelector('.reading-card-badge')).toBeTruthy();
      expect(card.querySelector('.reading-card-category')).toBeTruthy();
      expect(card.querySelector('.reading-card-title')).toBeTruthy();
      expect(card.querySelector('.reading-card-summary')).toBeTruthy();
      expect(card.querySelector('.vocab-fit-indicator')).toBeTruthy();
      expect(card.querySelector('.story-cta')).toBeTruthy();
    }
  });

  it('renders pedagogical reveal overlay with real lexical counts without fabricating reason when missing', () => {
    fixture.detectChanges();
    const firstCard = fixture.nativeElement.querySelector('.colombia-story-card');
    const reveal = firstCard.querySelector('.recommendation-metrics-reveal') as HTMLElement;
    expect(reveal).toBeTruthy();
    expect(reveal.textContent).toContain('Fit 30%');
    expect(reveal.textContent).not.toContain('Compatibility');
    expect(reveal.textContent).toContain('0 Known words');
    expect(reveal.textContent).toContain('0 Learning words');
    expect(reveal.textContent).toContain('252 Words to learn');
    expect(reveal.textContent).toContain('Open reading →');

    // When reasonCode is null (as returned in real listCollectionReadings response):
    homeService.parseCollectionReadings.mockReturnValue({
      page: 0, size: 10, totalElements: 1,
      readings: [mockReading({ reasonCode: null, knownWords: 5, learningWords: 3, unclassifiedWords: 150 })],
    });
    fixture.componentInstance.retryTopicCollection();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.colombia-story-card');
    const cardReveal = card.querySelector('.recommendation-metrics-reveal');
    expect(cardReveal.querySelector('.reading-card-reason-reveal')).toBeNull();
    expect(cardReveal.textContent).toContain('5 Known words');
    expect(cardReveal.textContent).toContain('3 Learning words');
    expect(cardReveal.textContent).toContain('150 Words to learn');
  });

  it('preserves short CTA on base card while keeping long CTA and Fit label in reveal overlay', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.colombia-story-card');
    expect(cards).toHaveLength(5);

    // Card 1: NOT_STARTED
    const baseCta1 = cards[0].querySelector('.story-footer .story-cta')?.textContent?.trim();
    const revealCta1 = cards[0].querySelector('.recommendation-metrics-reveal .reading-card-reveal-cta')?.textContent?.trim();
    expect(baseCta1).toBe('Open →');
    expect(revealCta1).toBe('Open reading →');

    // Card 2: IN_PROGRESS
    const baseCta2 = cards[1].querySelector('.story-footer .story-cta')?.textContent?.trim();
    const revealCta2 = cards[1].querySelector('.recommendation-metrics-reveal .reading-card-reveal-cta')?.textContent?.trim();
    expect(baseCta2).toBe('Continue →');
    expect(revealCta2).toBe('Continue reading →');

    // Card 3: COMPLETED
    const baseCta3 = cards[2].querySelector('.story-footer .story-cta')?.textContent?.trim();
    const revealCta3 = cards[2].querySelector('.recommendation-metrics-reveal .reading-card-reveal-cta')?.textContent?.trim();
    expect(baseCta3).toBe('Re-read →');
    expect(revealCta3).toBe('Re-read →');

    // Fit label in reveal:
    for (const card of Array.from(cards)) {
      const reveal = (card as HTMLElement).querySelector('.recommendation-metrics-reveal');
      expect(reveal?.textContent).toContain('Fit ');
      expect(reveal?.textContent).not.toContain('Compatibility');
    }
  });

  it('adopts the universal standard reading card structure for cross-universe parity', () => {
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('.editorial-stories-grid');
    expect(grid).toBeTruthy();

    const standardCards = fixture.nativeElement.querySelectorAll('.editorial-story-card');
    expect(standardCards).toHaveLength(5);

    const firstCard = standardCards[0] as HTMLElement;
    expect(firstCard.querySelector('.reading-card-cover')).toBeTruthy();
    expect(firstCard.querySelector('.recommendation-card-body')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-metadata')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-badge')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-title')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-desc')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-summary')).toBeTruthy();
    expect(firstCard.querySelector('.reading-card-cta')).toBeTruthy();
  });

  describe('Hero background image carousel', () => {
    it('renders hero image slides with index 0 active initially', () => {
      fixture.detectChanges();
      const slides = fixture.nativeElement.querySelectorAll('.colombia-banner-img-slide');
      expect(slides.length).toBe(2);
      expect(slides[0].classList.contains('active')).toBe(true);
      expect(slides[1].classList.contains('active')).toBe(false);
      expect(slides[0].style.backgroundImage).toContain('hero-colombia-villa-de-leyva.webp');
      expect(slides[1].style.backgroundImage).toContain('hero-colombia-valle-de-cocora.webp');
    });

    it('renders synchronized location chip for the active slide', () => {
      fixture.detectChanges();
      const locChip = fixture.nativeElement.querySelector('.colombia-location-chip');
      expect(locChip).toBeTruthy();
      expect(locChip.textContent).toContain('Villa de Leyva, Boyacá');
    });

    it('renders discrete indicator dots and allows manual image selection', () => {
      fixture.detectChanges();
      const dots = fixture.nativeElement.querySelectorAll('.colombia-banner-dot');
      expect(dots.length).toBe(2);
      expect(dots[0].classList.contains('active')).toBe(true);
      expect(dots[1].classList.contains('active')).toBe(false);

      // Click second dot
      dots[1].click();
      fixture.detectChanges();

      expect(component.activeImageIndex()).toBe(1);
      expect(dots[0].classList.contains('active')).toBe(false);
      expect(dots[1].classList.contains('active')).toBe(true);

      const slides = fixture.nativeElement.querySelectorAll('.colombia-banner-img-slide');
      expect(slides[0].classList.contains('active')).toBe(false);
      expect(slides[1].classList.contains('active')).toBe(true);

      const locChip = fixture.nativeElement.querySelector('.colombia-location-chip');
      expect(locChip.textContent).toContain('Valle de Cocora, Quindío');
    });

    it('pauses rotation on mouse enter and resumes on mouse leave', () => {
      fixture.detectChanges();
      expect(component.isPaused()).toBe(false);

      const banner = fixture.nativeElement.querySelector('.colombia-featured-banner');
      banner.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(component.isPaused()).toBe(true);

      banner.dispatchEvent(new MouseEvent('mouseleave'));
      fixture.detectChanges();
      expect(component.isPaused()).toBe(false);
    });
  });

  describe('Adaptive container queries layout', () => {
    it('declares the container root and renders all topic pills and reading cards', () => {
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector('.colombia-universe') as HTMLElement;
      expect(root).toBeTruthy();
      expect(root.getAttribute('aria-label')).toContain('Colombia');

      const pillsBar = root.querySelector('.topic-pills-bar');
      expect(pillsBar).toBeTruthy();
      expect(pillsBar?.children.length).toBe(5);

      const storiesGrid = root.querySelector('.colombia-stories-grid');
      expect(storiesGrid).toBeTruthy();
      expect(storiesGrid?.querySelectorAll('.colombia-story-card').length).toBe(5);
    });
  });

  describe('Carousel rail navigation', () => {
    it('wraps the stories grid inside a rail-shell', () => {
      fixture.detectChanges();
      const railShell = fixture.nativeElement.querySelector('.colombia-stories-container .rail-shell');
      expect(railShell).toBeTruthy();
      expect(railShell.querySelector('.colombia-stories-grid')).toBeTruthy();
    });

    it('renders next button with aria-label="Next stories" when overflow exists', () => {
      fixture.detectChanges();
      component.railHasOverflow.set(true);
      component.railAtStart.set(true);
      component.railAtEnd.set(false);
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.rail-arrow-next') as HTMLButtonElement;
      const prevBtn = fixture.nativeElement.querySelector('.rail-arrow-previous');

      expect(nextBtn).toBeTruthy();
      expect(nextBtn.getAttribute('aria-label')).toBe('Next stories');
      expect(prevBtn).toBeFalsy();
    });

    it('renders previous button with aria-label="Previous stories" when rail has advanced', () => {
      fixture.detectChanges();
      component.railHasOverflow.set(true);
      component.railAtStart.set(false);
      component.railAtEnd.set(false);
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.rail-arrow-next');
      const prevBtn = fixture.nativeElement.querySelector('.rail-arrow-previous') as HTMLButtonElement;

      expect(prevBtn).toBeTruthy();
      expect(prevBtn.getAttribute('aria-label')).toBe('Previous stories');
      expect(nextBtn).toBeTruthy();
    });

    it('hides next button when rail reaches end', () => {
      fixture.detectChanges();
      component.railHasOverflow.set(true);
      component.railAtStart.set(false);
      component.railAtEnd.set(true);
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.rail-arrow-next');
      const prevBtn = fixture.nativeElement.querySelector('.rail-arrow-previous');

      expect(nextBtn).toBeFalsy();
      expect(prevBtn).toBeTruthy();
    });

    it('hides both buttons when there is no overflow', () => {
      fixture.detectChanges();
      component.railHasOverflow.set(false);
      component.railAtStart.set(true);
      component.railAtEnd.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.rail-arrow-next')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.rail-arrow-previous')).toBeFalsy();
    });

    it('delegates clicks on navigation buttons to scrollStories', () => {
      fixture.detectChanges();
      component.railHasOverflow.set(true);
      component.railAtStart.set(false);
      component.railAtEnd.set(false);
      fixture.detectChanges();

      const scrollSpy = vi.spyOn(component, 'scrollStories').mockImplementation(() => {});

      const nextBtn = fixture.nativeElement.querySelector('.rail-arrow-next') as HTMLButtonElement;
      nextBtn.click();
      expect(scrollSpy).toHaveBeenCalledWith('next');

      const prevBtn = fixture.nativeElement.querySelector('.rail-arrow-previous') as HTMLButtonElement;
      prevBtn.click();
      expect(scrollSpy).toHaveBeenCalledWith('previous');
    });

    it('updates position signals during onStoriesScroll event', () => {
      fixture.detectChanges();
      const mockElement = {
        scrollWidth: 2000,
        clientWidth: 1000,
        scrollLeft: 500,
      } as HTMLElement;

      component.onStoriesScroll({ currentTarget: mockElement } as unknown as Event);

      expect(component.railHasOverflow()).toBe(true);
      expect(component.railAtStart()).toBe(false);
      expect(component.railAtEnd()).toBe(false);
    });
  });
});
