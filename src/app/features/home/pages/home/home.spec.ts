import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { LibraryService } from '../../../library/services/library';
import { HomeService } from '../../services/home';
import { ContinueReadingItem, RecommendedPlatformReading, ReadingOrigin } from '../../models/home.models';
import { UserReading } from '../../../library/models/library.models';
import { UserProfile } from '../../../profile/models/profile.models';
import { ProfileService } from '../../../profile/services/profile';
import { userTextCoverUrl } from '../../../../shared/utils/user-text-cover';
import {
  Home,
  calculateKnownPercentage,
  calculateWordsToLearn,
  wordCountLabel,
} from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let recommendationResponse: Subject<string>;
  let continueReadingResponse: Subject<string>;
  let userReadingsResponse: Subject<string>;
  let collectionsResponse: Subject<string>;
  let profile: WritableSignal<UserProfile | null>;
  let homeService: {
    recommendPlatformReadings: ReturnType<typeof vi.fn>;
    parseRecommendations: ReturnType<typeof vi.fn>;
    listCollections: ReturnType<typeof vi.fn>;
    parseCollections: ReturnType<typeof vi.fn>;
    listCollectionReadings: ReturnType<typeof vi.fn>;
    parseCollectionReadings: ReturnType<typeof vi.fn>;
    listContinueReading: ReturnType<typeof vi.fn>;
    parseContinueReading: ReturnType<typeof vi.fn>;
  };
  let libraryService: {
    listUserReadings: ReturnType<typeof vi.fn>;
    parseUserReadings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recommendationResponse = new Subject<string>();
    continueReadingResponse = new Subject<string>();
    userReadingsResponse = new Subject<string>();
    collectionsResponse = new Subject<string>();
    profile = signal<UserProfile | null>(null);
    homeService = {
      recommendPlatformReadings: vi.fn(() =>
        recommendationResponse.asObservable()
      ),
      parseRecommendations: vi.fn(),
      listCollections: vi.fn(() => collectionsResponse.asObservable()),
      parseCollections: vi.fn(),
      listCollectionReadings: vi.fn(),
      parseCollectionReadings: vi.fn(),
      listContinueReading: vi.fn(() => continueReadingResponse.asObservable()),
      parseContinueReading: vi.fn(),
    };
    libraryService = {
      listUserReadings: vi.fn(() => userReadingsResponse.asObservable()),
      parseUserReadings: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: HomeService, useValue: homeService },
        { provide: LibraryService, useValue: libraryService },
        { provide: ProfileService, useValue: { profile } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
  });

  it('greets with alias before the profile name', () => {
    profile.set(userProfile({ name: 'Marlon Davián Vásquez Sierra', alias: 'LectorMarlon' }));
    fixture.detectChanges();

    expect(componentText()).toContain('Hola, LectorMarlon 👋');
    expect(componentText()).not.toContain('Hola, Marlon Davián');
  });

  it('greets with only the first name when alias is unavailable', () => {
    profile.set(userProfile({ name: '  Marlon Davián Vásquez Sierra  ', alias: null }));
    fixture.detectChanges();

    expect(componentText()).toContain('Hola, Marlon 👋');
    expect(componentText()).not.toContain('Marlon Davián Vásquez Sierra');
  });

  it('uses the generic greeting while no usable name is available and never derives it from email', () => {
    profile.set(userProfile({ name: '   ', alias: '   ', email: 'marlon@example.com' }));
    fixture.detectChanges();

    expect(componentText()).toContain('Hola 👋');
    expect(componentText()).not.toContain('marlon');
    expect(componentText()).toContain('¿Qué te gustaría leer hoy?');
  });

  it('loads recommendations and continue reading from independent endpoints', () => {
    fixture.detectChanges();

    expect(homeService.recommendPlatformReadings).toHaveBeenCalledWith(0, 12);
    expect(homeService.listContinueReading).toHaveBeenCalledWith(0, 10);
    expect(libraryService.listUserReadings).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Cargando recomendaciones'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Mis lecturas');
  });

  it('renders recommendation cards but no personal-reading section', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage());
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Recommended story');
    expect(fixture.nativeElement.textContent).toContain(
      '90% vocab fit'
    );
    expect(fixture.nativeElement.querySelector('.recommendation-metrics-reveal')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('My own reading');
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T12:00:00Z');
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/platform-1"]')
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.user-readings-carousel')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Mis lecturas');
    expect(fixture.nativeElement.textContent).not.toContain('Ver más');
  });

  it('renders the friendly explanation on recommendation cards in reveal when reasonCode is present', () => {
    homeService.parseRecommendations.mockReturnValue(
      recommendationsPage([
        recommendedReading({
          readingId: 'rec-reason-1',
          title: 'Reason Story',
          reasonCode: 'BALANCED_CHALLENGE',
        }),
      ])
    );
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('app-home-reading-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.reading-card-reason-reveal')?.textContent).toContain(
      'Combina vocabulario familiar con nuevas palabras por descubrir.'
    );
    expect(card.querySelector('.reading-card-primary-metric')?.textContent).toContain(
      '90% vocab fit'
    );
    expect(card.textContent).not.toContain('BALANCED_CHALLENGE');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
  });

  it('renders fit indicator in base state in amber for DISCOVERY while keeping reason in reveal', () => {
    homeService.parseRecommendations.mockReturnValue(
      recommendationsPage([
        recommendedReading({
          readingId: 'rec-discovery-1',
          title: 'Discovery Story',
          reasonCode: 'DISCOVERY',
          vocabularyFitPercentage: 31,
        }),
      ])
    );
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('app-home-reading-card');
    expect(card).toBeTruthy();
    // In base state, reason is omitted and fit indicator is rendered with amber discovery classes
    expect(card.querySelector('.reading-card-reason')).toBeNull();
    const fitIndicator = card.querySelector('.reading-card-summary .reading-card-fit-indicator');
    expect(fitIndicator).toBeTruthy();
    expect(fitIndicator?.textContent).toContain('31% vocab fit');
    expect(fitIndicator?.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(fitIndicator?.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(card.querySelector('.reading-card-discovery-indicator')).toBeNull();
    expect(fitIndicator?.textContent).not.toContain('Discover');

    // In reveal state, friendly reason is present
    const reveal = card.querySelector('.recommendation-metrics-reveal');
    expect(reveal).toBeTruthy();
    expect(reveal.querySelector('.reading-card-reason-reveal')?.textContent).toContain(
      'Estamos conociendo tu vocabulario para mejorar tus recomendaciones.'
    );
    expect(reveal.textContent).toContain('Compatibility 31%');
    expect(card.textContent).not.toContain('DISCOVERY');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
  });

  it('does not render a reason in reveal when reasonCode is null on recommendation cards', () => {
    homeService.parseRecommendations.mockReturnValue(
      recommendationsPage([
        recommendedReading({
          readingId: 'rec-no-reason',
          title: 'Story Without Reason',
          reasonCode: null,
        }),
      ])
    );
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('app-home-reading-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.reading-card-reason-reveal')).toBeNull();
    expect(card.querySelector('.reading-card-primary-metric')?.textContent).toContain(
      '90% vocab fit'
    );
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
  });

  it('does NOT render reason in base state on rail cards, but renders it exclusively in reveal', () => {
    homeService.parseRecommendations.mockReturnValue(
      recommendationsPage([
        recommendedReading({
          readingId: 'rail-1',
          title: 'Rail Story',
          reasonCode: 'MORE_CHALLENGING',
        }),
      ])
    );
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    fixture.detectChanges();

    const railCard = fixture.nativeElement.querySelector('app-home-reading-card');
    expect(railCard).toBeTruthy();
    // No reason in resting base state
    expect(railCard.querySelector('.reading-card-reason')).toBeNull();
    // Fit indicator remains in base state for non-DISCOVERY
    expect(railCard.querySelector('.reading-card-summary .reading-card-primary-metric')?.textContent).toContain(
      '90% vocab fit'
    );
    // Reveal contains friendly reason and no raw code
    const revealReason = railCard.querySelector('.reading-card-reason-reveal');
    expect(revealReason).toBeTruthy();
    expect(revealReason.textContent).toContain(
      'Esta lectura ofrece un reto de vocabulario un poco mayor.'
    );
    expect(railCard.textContent).not.toContain('MORE_CHALLENGING');
  });

  it('renders fit indicator in base state on rail cards for DISCOVERY in amber while keeping reason in reveal', () => {
    homeService.parseRecommendations.mockReturnValue(
      recommendationsPage([
        recommendedReading({
          readingId: 'rail-discovery',
          title: 'Discovery Rail Story',
          reasonCode: 'DISCOVERY',
          vocabularyFitPercentage: 31,
        }),
      ])
    );
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    fixture.detectChanges();

    const railCard = fixture.nativeElement.querySelector('app-home-reading-card');
    expect(railCard).toBeTruthy();
    // In resting state, reason is omitted and fit indicator is rendered with amber discovery classes
    expect(railCard.querySelector('.reading-card-reason')).toBeNull();
    const fitIndicator = railCard.querySelector('.reading-card-summary .reading-card-fit-indicator');
    expect(fitIndicator).toBeTruthy();
    expect(fitIndicator?.textContent).toContain('31% vocab fit');
    expect(fitIndicator?.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(fitIndicator?.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(railCard.querySelector('.reading-card-discovery-indicator')).toBeNull();
    expect(fitIndicator?.textContent).not.toContain('Discover');

    // Reveal contains reason
    const reveal = railCard.querySelector('.recommendation-metrics-reveal');
    expect(reveal).toBeTruthy();
    expect(reveal.querySelector('.reading-card-reason-reveal')?.textContent).toContain(
      'Estamos conociendo tu vocabulario para mejorar tus recomendaciones.'
    );
    expect(reveal.textContent).toContain('Compatibility 31%');
    expect(railCard.textContent).not.toContain('DISCOVERY');
  });

  it('renders the recommendation empty state without a personal-reading empty state', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No hay recomendaciones disponibles'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Aún no has añadido lecturas');
  });

  it('renders recommendation errors without exposing the supporting user-reading request', () => {
    fixture.detectChanges();
    recommendationResponse.error(new Error('recommendations failed'));
    userReadingsResponse.error(new Error('readings failed'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar las recomendaciones'
    );
    expect(fixture.nativeElement.textContent).not.toContain('No se pudieron cargar tus lecturas');
  });

  it('does not duplicate the AppShell library navigation inside Home', () => {
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>
    );

    expect(links.some((link) => link.getAttribute('href') === '/library')).toBe(false);
    expect(fixture.nativeElement.querySelector('nav')).toBeFalsy();
  });

  it('calculates and rounds known percentage for presentation', () => {
    expect(calculateKnownPercentage({ uniqueWords: 100, knownWords: 35 })).toBe(
      35
    );
    expect(calculateKnownPercentage({ uniqueWords: 6, knownWords: 2 })).toBe(33);
    expect(calculateKnownPercentage({ uniqueWords: 0, knownWords: 0 })).toBe(0);
  });

  it('calculates words to learn without learning or ignored words', () => {
    const reading = recommendedReading();

    expect(calculateWordsToLearn(reading)).toBe(8);
    expect(reading.learningWords).toBe(2);
    expect(reading.ignoredWords).toBe(1);
    expect(reading.unclassifiedWords).toBe(7);
    expect(reading.explicitNewWords).toBe(1);
  });

  it('formats singular and plural vocabulary counts', () => {
    expect(wordCountLabel(1, 'palabra conocida', 'palabras conocidas')).toBe(
      '1 palabra conocida'
    );
    expect(wordCountLabel(2, 'palabra conocida', 'palabras conocidas')).toBe(
      '2 palabras conocidas'
    );
  });

  it('derives metrics without additional SOAP requests', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage());
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();

    expect(homeService.recommendPlatformReadings).toHaveBeenCalledOnce();
    expect(homeService.listContinueReading).toHaveBeenCalledOnce();
    expect(libraryService.listUserReadings).not.toHaveBeenCalled();
  });

  it('shows USER and PLATFORM from listContinueReading and deduplicates by readingId', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('shared', 'USER', 'My text'),
      continueReadingItem('platform', 'PLATFORM', 'Platform story'),
      continueReadingItem('shared', 'USER', 'Duplicate'),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    continueReadingResponse.next('<response/>');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.continue-reading-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.continue-reading-cta-pill')).toHaveLength(2);
    expect(componentText()).toContain('Tu lectura');
    expect(componentText()).toContain('A1 · Daily Life');
    expect(componentText()).toContain('En progreso');
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledOnce();
    expect(homeService.listContinueReading).toHaveBeenCalledOnce();
    expect(libraryService.listUserReadings).not.toHaveBeenCalled();
    const userCard = fixture.nativeElement.querySelector('a[href="/reading/shared"]') as HTMLElement;
    const platformCard = fixture.nativeElement.querySelector('a[href="/reading/platform"]') as HTMLElement;
    expect(userCard).toBeTruthy();
    expect(userCard.querySelector('img')?.getAttribute('src')).toBe(userTextCoverUrl('shared'));
    expect(userCard.querySelector('.continue-user-visual')).toBeFalsy();
    expect(userCard.textContent).not.toContain('Aa');
    expect(userCard.textContent).not.toContain('Texto');
    expect(platformCard.querySelector('img')?.getAttribute('src')).toBe('/assets/reading-covers/platform-cover.webp');
    expect(platformCard.textContent).toContain('A1 · Daily Life');
    expect(platformCard.textContent).toContain('En progreso');
    expect(platformCard.textContent).toContain('Continuar');
  });

  it('uses the safe cover fallback for PLATFORM without coverKey', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      { ...continueReadingItem('platform-no-cover', 'PLATFORM', 'No cover'), coverKey: null },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('continue'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('a[href="/reading/platform-no-cover"]') as HTMLElement;
    expect(card.querySelector('img')).toBeFalsy();
    expect(card.querySelector('.cover-fallback')).toBeTruthy();
  });

  it('replaces a failed PLATFORM image with the fallback without breaking navigation', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('broken-cover', 'PLATFORM', 'Broken cover'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('continue'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('a[href="/reading/broken-cover"]') as HTMLElement;
    (card.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(card.querySelector('img')).toBeFalsy();
    expect(card.querySelector('.cover-fallback')).toBeTruthy();
    expect(card.textContent).toContain('Broken cover');
    expect(card.textContent).toContain('Continuar');
  });

  it('keeps a USER cover stable after rerender and safely falls back on image error', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('stable-user', 'USER', 'Stable user reading'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('continue'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('a[href="/reading/stable-user"]') as HTMLElement;
    const firstImage = card.querySelector('img') as HTMLImageElement;
    const firstUrl = firstImage.getAttribute('src');

    fixture.detectChanges();
    expect(card.querySelector('img')?.getAttribute('src')).toBe(firstUrl);
    expect(firstUrl).toBe(userTextCoverUrl('stable-user'));

    firstImage.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(card.querySelector('img')).toBeFalsy();
    expect(card.querySelector('.cover-fallback')).toBeTruthy();
    expect(card.getAttribute('href')).toBe('/reading/stable-user');
  });

  it('shows a PLATFORM in progress even when recommendations contain only not-started readings', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([recommendedReading()]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('platform-progress', 'PLATFORM', 'Persisted platform'),
    ]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); continueReadingResponse.next('continue'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/reading/platform-progress"]')).toBeTruthy();
    expect(componentText()).toContain('Persisted platform');
  });

  it('renders Continue Reading BEFORE Recommendations when IN_PROGRESS items exist', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading({ readingId: 'rec-1', title: 'Recommended Novel' }),
    ]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('in-prog-1', 'PLATFORM', 'In Progress Story'),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.next('c');
    fixture.detectChanges();

    const continueHeading = fixture.nativeElement.querySelector('#continue-reading-heading') as HTMLElement;
    const recommendationsHeading = fixture.nativeElement.querySelector('#recommendations-heading') as HTMLElement;
    expect(continueHeading).toBeTruthy();
    expect(recommendationsHeading).toBeTruthy();
    expect(recommendationsHeading.textContent).toContain('Recomendadas para ti');
    expect(componentText()).not.toContain('Más recomendaciones para ti');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();

    // Continue section precedes Recommendations section in DOM tree
    expect(continueHeading.compareDocumentPosition(recommendationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const sections = Array.from(fixture.nativeElement.querySelectorAll('main > section') as NodeListOf<HTMLElement>);
    const sectionLabels = sections.map((s) => s.getAttribute('aria-labelledby'));
    expect(sectionLabels[0]).toBe('continue-reading-heading');
    expect(sectionLabels[1]).toBe('recommendations-heading');
  });

  it('renders Continue Reading section with error message BEFORE Recommendations when continue reading fails', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading({ readingId: 'rec-1', title: 'Recommended Novel' }),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.error(new Error('Network error'));
    fixture.detectChanges();

    const continueHeading = fixture.nativeElement.querySelector('#continue-reading-heading') as HTMLElement;
    const recommendationsHeading = fixture.nativeElement.querySelector('#recommendations-heading') as HTMLElement;
    expect(continueHeading).toBeTruthy();
    expect(recommendationsHeading).toBeTruthy();
    expect(recommendationsHeading.textContent).toContain('Recomendadas para ti');
    expect(componentText()).toContain('No se pudieron cargar las lecturas en progreso');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();

    expect(continueHeading.compareDocumentPosition(recommendationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const sections = Array.from(fixture.nativeElement.querySelectorAll('main > section') as NodeListOf<HTMLElement>);
    const sectionLabels = sections.map((s) => s.getAttribute('aria-labelledby'));
    expect(sectionLabels[0]).toBe('continue-reading-heading');
    expect(sectionLabels[1]).toBe('recommendations-heading');
  });

  it('does not render Continue Reading section when continue list is empty (CASO A)', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading({ readingId: 'rec-1', title: 'Recommended Novel' }),
    ]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([]));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.next('c');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#continue-reading-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.continue-reading-carousel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
    const recommendationsHeading = fixture.nativeElement.querySelector('#recommendations-heading') as HTMLElement;
    expect(recommendationsHeading.textContent).toContain('Recomendadas para ti');
    expect(componentText()).not.toContain('Más recomendaciones para ti');
  });

  it('renders Continue Reading and empty recommendations fallback when recommendations are empty (CASO C)', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('in-prog-1', 'PLATFORM', 'In Progress Story'),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.next('c');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#continue-reading-heading')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.continue-reading-carousel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
    expect(componentText()).toContain('No hay recomendaciones disponibles en este momento.');
  });

  it('hides Continue Reading and renders empty recommendations fallback when both are empty (CASO D)', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([]));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.next('c');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#continue-reading-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
    expect(componentText()).toContain('No hay recomendaciones disponibles en este momento.');
  });

  it('handles disjoint Continue Reading and Recommendations without re-ranking or filtering backend order', () => {
    const recs = [
      recommendedReading({ readingId: 'platform-10', title: 'Rank 1 Book', reasonCode: 'BALANCED_CHALLENGE' }),
      recommendedReading({ readingId: 'platform-20', title: 'Rank 2 Book', reasonCode: 'PRACTICE_VOCABULARY' }),
      recommendedReading({ readingId: 'platform-30', title: 'Rank 3 Book', reasonCode: 'HIGH_VOCABULARY_MATCH' }),
    ];
    const inProgress = [
      continueReadingItem('prog-user-1', 'USER', 'User Reading in Progress'),
      continueReadingItem('prog-plat-2', 'PLATFORM', 'Platform Reading in Progress'),
    ];
    homeService.parseRecommendations.mockReturnValue(recommendationsPage(recs));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage(inProgress));
    fixture.detectChanges();
    recommendationResponse.next('r');
    continueReadingResponse.next('c');
    fixture.detectChanges();

    // Continue Reading cards
    const continueCards = Array.from(
      fixture.nativeElement.querySelectorAll('.continue-reading-card') as NodeListOf<HTMLAnchorElement>
    );
    expect(continueCards.map((c) => c.getAttribute('href'))).toEqual(['/reading/prog-user-1', '/reading/prog-plat-2']);

    // Recommendations rail strictly preserves ALL backend recommendations starting from rank 0
    const railLinks = Array.from(
      fixture.nativeElement.querySelectorAll('.recommendations-carousel .recommendation-card') as NodeListOf<HTMLAnchorElement>
    );
    expect(railLinks.map((l) => l.getAttribute('href'))).toEqual([
      '/reading/platform-10',
      '/reading/platform-20',
      '/reading/platform-30',
    ]);
    expect(railLinks[0].textContent).toContain('Rank 1 Book');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
  });

  it('isolates a continue-reading failure from recommendations and collections', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    homeService.parseCollections.mockReturnValue([]);
    fixture.detectChanges();
    recommendationResponse.next('recommendations');
    collectionsResponse.next('collections');
    continueReadingResponse.error(new Error('continue reading failed'));
    fixture.detectChanges();
    expect(componentText()).toContain('No se pudieron cargar las lecturas en progreso');
    expect(componentText()).toContain('Recommended story');
  });

  it('keeps all continue-reading cards in one horizontal rail', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage(
      Array.from({ length: 4 }, (_, index) => continueReadingItem(`progress-${index}`, 'PLATFORM', `Progress ${index}`))
    ));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const rail = fixture.nativeElement.querySelector('.continue-reading-carousel') as HTMLElement;
    expect(rail).toBeTruthy();
    expect(rail.querySelectorAll('.continue-reading-card')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.grid .continue-reading-card')).toBeFalsy();
  });

  it('excludes completed and not-started readings from continue-reading and labels completed cards', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([{ ...recommendedReading(), progressStatus: 'COMPLETED' as const }]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      { ...continueReadingItem('completed', 'PLATFORM', 'Completed'), progressStatus: 'COMPLETED' },
      { ...continueReadingItem('not-started', 'USER', 'Not started'), progressStatus: null as never },
    ]));
    fixture.detectChanges(); recommendationResponse.next('x'); continueReadingResponse.next('x'); fixture.detectChanges();
    expect(componentText()).not.toContain('Continuar leyendo');
    expect(componentText()).toContain('Re-read →');
  });

  it('renders amber fit indicator for DISCOVERY recommendations in resting state even with 0% vocab fit', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading({ readingId: 'discovery-1', reasonCode: 'DISCOVERY', vocabularyFitPercentage: 0 }),
    ]));
    fixture.detectChanges(); recommendationResponse.next('r'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.recommendations-carousel app-home-reading-card');
    expect(card).toBeTruthy();
    const fitIndicator = card.querySelector('.reading-card-fit-indicator');
    expect(fitIndicator).toBeTruthy();
    expect(fitIndicator?.textContent).toContain('0% vocab fit');
    expect(fitIndicator?.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(fitIndicator?.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(card.querySelector('.reading-card-discovery-indicator')).toBeNull();
    expect(card.textContent).not.toContain('Discover');
  });

  it('renders collection cards with signal icon and real vocab fit without showing Discover', () => {
    const colReadings = [collectionReading('col-1')];
    homeService.parseCollections.mockReturnValue([collection('nature', 'Nature & Places', 1)]);
    homeService.parseCollectionReadings.mockReturnValue(collectionPage(colReadings));
    const collectionReadingsSub = new Subject<string>();
    homeService.listCollectionReadings.mockReturnValue(collectionReadingsSub.asObservable());

    fixture.detectChanges();
    collectionsResponse.next('cols');
    fixture.detectChanges();
    collectionReadingsSub.next('reads');
    fixture.detectChanges();

    const collectionCard = fixture.nativeElement.querySelector('.collection-card');
    expect(collectionCard).toBeTruthy();
    expect(collectionCard.querySelector('.reading-card-fit-indicator')?.textContent).toContain('90% vocab fit');
    expect(collectionCard.querySelector('.reading-card-discovery-indicator')).toBeNull();
    expect(collectionCard.textContent).not.toContain('Discover');
  });

  // ---- V6.1 Continue Reading Card Tests ----

  it('renders continue-reading card with context metadata, serif title, and cta-pill', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-v6', 'PLATFORM', 'The Camera on Platform Three'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-v6"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.querySelector('.continue-reading-context')?.textContent).toContain('A1 · Daily Life');
    expect(card.querySelector('.continue-reading-title')?.textContent).toContain('The Camera on Platform Three');
    expect(card.querySelector('.continue-reading-status')?.textContent).toContain('En progreso');
    expect(card.querySelector('.continue-reading-cta-pill')?.textContent?.trim()).toBe('Continuar');
  });

  it('renders short description when description exists (A)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      {
        ...continueReadingItem('cr-desc', 'PLATFORM', 'Story with Description'),
        description: 'A reflective story about language and connection.',
      },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-desc"]') as HTMLElement;
    expect(card.querySelector('.continue-reading-desc')?.textContent).toBe(
      'A reflective story about language and connection.'
    );
  });

  it('omits description slot cleanly when description does not exist (B)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-no-desc', 'PLATFORM', 'Story without Description'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-no-desc"]') as HTMLElement;
    expect(card.querySelector('.continue-reading-desc')).toBeNull();
  });

  it('renders progress bar and fill when progressPercentage exists (C & D)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      { ...continueReadingItem('cr-pct', 'PLATFORM', 'Story with percentage'), progressPercentage: 62 },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-pct"]') as HTMLElement;
    const progressWrap = card.querySelector('.continue-reading-progress-wrap');
    const progressFill = card.querySelector('.continue-reading-progress-fill') as HTMLElement;
    expect(progressWrap).toBeTruthy();
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.width).toBe('62%');
  });

  it('renders "62% completado" when progressPercentage is 62 and replaces "En progreso" (E)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      { ...continueReadingItem('cr-pct-62', 'PLATFORM', 'Story 62%'), progressPercentage: 62 },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-pct-62"]') as HTMLElement;
    expect(card.querySelector('.continue-reading-progress-text')?.textContent).toContain('62% completado');
    expect(card.textContent).not.toContain('En progreso');
  });

  it('renders "En progreso" in footer when progressPercentage is absent or null (F)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-in-prog', 'PLATFORM', 'Story in Progress'),
      { ...continueReadingItem('cr-null-pct', 'PLATFORM', 'Story null percentage'), progressPercentage: null },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card1 = fixture.nativeElement.querySelector('a[href="/reading/cr-in-prog"]') as HTMLElement;
    const card2 = fixture.nativeElement.querySelector('a[href="/reading/cr-null-pct"]') as HTMLElement;
    expect(card1.querySelector('.continue-reading-status')?.textContent).toContain('En progreso');
    expect(card1.querySelector('.continue-reading-progress-text')).toBeNull();
    expect(card1.querySelector('.continue-reading-progress-wrap')).toBeNull();
    expect(card2.querySelector('.continue-reading-status')?.textContent).toContain('En progreso');
    expect(card2.querySelector('.continue-reading-progress-wrap')).toBeNull();
  });

  it('always renders CTA "Continuar" pill regardless of progress percentage presence (G)', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-cta-1', 'PLATFORM', 'Card without pct'),
      { ...continueReadingItem('cr-cta-2', 'PLATFORM', 'Card with pct'), progressPercentage: 38 },
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card1 = fixture.nativeElement.querySelector('a[href="/reading/cr-cta-1"]') as HTMLElement;
    const card2 = fixture.nativeElement.querySelector('a[href="/reading/cr-cta-2"]') as HTMLElement;
    expect(card1.querySelector('.continue-reading-cta-pill')?.textContent?.trim()).toBe('Continuar');
    expect(card2.querySelector('.continue-reading-cta-pill')?.textContent?.trim()).toBe('Continuar');
  });

  it('shows "Ver todo" in continue reading section heading row', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-vertodo', 'PLATFORM', 'Some story'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('#continue-reading-heading')?.closest('section') as HTMLElement;
    expect(section.querySelector('.section-more-link')?.textContent).toContain('Ver todo');
    expect(section.querySelector('.section-more-link')?.textContent).not.toContain('See all');
  });

  it('renders USER context label "Tu lectura" and shows continue reading pill CTA', () => {
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-user', 'USER', 'Mi propio texto'),
    ]));
    fixture.detectChanges(); continueReadingResponse.next('x'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/reading/cr-user"]') as HTMLElement;
    expect(card.querySelector('.continue-reading-context')?.textContent).toContain('Tu lectura');
    expect(card.querySelector('.continue-reading-cta-pill')?.textContent?.trim()).toBe('Continuar');
  });

  it('renders recommendations in one native horizontal carousel', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading(),
      { ...recommendedReading(), readingId: 'platform-2', title: 'Second story' },
    ]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();

    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;
    expect(carousel).toBeTruthy();
    expect(carousel.getAttribute('role')).toBe('region');
    expect(carousel.getAttribute('tabindex')).toBe('0');
    expect(carousel.querySelectorAll('.recommendation-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.grid .recommendation-card')).toBeFalsy();
    expect(componentText()).not.toContain('Ver más');
  });

  it('renders all backend recommendations in carousel starting from rank one in exact order', () => {
    const readings = recommendationPage(0, 5, 5).readings;
    homeService.parseRecommendations.mockReturnValue(recommendationsPage(readings));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('ranked'); userReadingsResponse.next('users'); fixture.detectChanges();

    const railLinks = Array.from(
      fixture.nativeElement.querySelectorAll('.recommendations-carousel .recommendation-card') as NodeListOf<HTMLAnchorElement>
    );
    expect(railLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/reading/platform-0', '/reading/platform-1', '/reading/platform-2', '/reading/platform-3', '/reading/platform-4',
    ]);
    expect(railLinks[0].textContent).toContain('Story 0');
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeNull();
  });

  it('uses the shared vocabulary-card values in normal and reveal states for recommendation cards', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([recommendedReading()]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('featured'); userReadingsResponse.next('users'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.recommendation-card') as HTMLAnchorElement;
    const primaryMetric = card.querySelector('.reading-card-primary-metric') as HTMLElement;
    const reveal = card.querySelector('.recommendation-metrics-reveal') as HTMLElement;
    const cta = card.querySelector('.reading-card-cta') as HTMLElement;

    expect(card.getAttribute('href')).toBe('/reading/platform-1');
    expect(primaryMetric.textContent).toContain('90% vocab fit');
    expect(reveal.textContent).toContain('Compatibility 90%');
    expect(card.textContent).not.toContain('% de vocabulario conocido');
    expect(reveal.textContent).toContain('12 Known words');
    expect(reveal.textContent).toContain('2 Learning words');
    expect(reveal.textContent).toContain('8 Words to learn');
    expect(cta.textContent).toContain('Open reading');
    expect(card.textContent?.match(/Recommended story/g)).toHaveLength(1);
    expect(card.querySelector('.reading-card-cover')).toBeTruthy();
  });

  it.each([
    [31.4, '31% vocab fit', 'Compatibility 31%'],
    [76, '76% vocab fit', 'Compatibility 76%'],
    [0, '0% vocab fit', 'Compatibility 0%'],
  ])('formats vocabulary fit %s through the shared helper on recommendation cards', (value, expectedResting, expectedReveal) => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([{
      ...recommendedReading(),
      vocabularyFitPercentage: value,
    } as unknown as RecommendedPlatformReading]));
    fixture.detectChanges();
    recommendationResponse.next('featured');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.recommendation-card') as HTMLElement;
    expect(card.querySelector('.reading-card-primary-metric')?.textContent).toContain(expectedResting);
    expect(card.querySelector('.recommendation-metrics-reveal')?.textContent).toContain(expectedReveal);
    expect(card.textContent).not.toContain('% de vocabulario conocido');
    expect(card.textContent).not.toContain('NaN');
    expect(card.textContent).toContain('Recommended story');
    expect(card.textContent).toContain('A1');
    expect(card.textContent).toContain('Daily Life');
    expect(card.textContent).toContain('Open reading');
    expect(card.querySelector('.reading-card-cover')).toBeTruthy();
  });

  it('renders no carousel for zero recommendations and renders carousel with one card for one recommendation', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('empty'); userReadingsResponse.next('users'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.recommendations-carousel')).toBeFalsy();
    expect(componentText()).toContain('No hay recomendaciones disponibles en este momento.');

    fixture.componentInstance.recommendations.set([recommendedReading()]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.recommendations-carousel')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.recommendations-carousel app-home-reading-card')).toHaveLength(1);
  });

  it('loads only backend collections in display order with page zero and size eight', () => {
    const scienceResponse = new Subject<string>();
    const mysteryResponse = new Subject<string>();
    homeService.parseCollections.mockReturnValue([
      collection('science', 'Science, Technology & Ideas', 1),
      collection('mystery', 'Mysteries & Imagination', 2),
    ]);
    homeService.listCollectionReadings.mockImplementation((key: string) =>
      key === 'science' ? scienceResponse.asObservable() : mysteryResponse.asObservable()
    );
    homeService.parseCollectionReadings.mockImplementation((value: string) =>
      value === 'science-page' ? collectionPage([collectionReading('science-1')]) : collectionPage([])
    );
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections'); fixture.detectChanges();

    expect(homeService.listCollectionReadings).toHaveBeenCalledWith('science', 0, 8);
    expect(homeService.listCollectionReadings).toHaveBeenCalledWith('mystery', 0, 8);
    scienceResponse.next('science-page'); mysteryResponse.next('mystery-page'); fixture.detectChanges();
    const sections = fixture.nativeElement.querySelectorAll('.collection-section');
    expect(sections).toHaveLength(1);
    expect(sections[0].textContent).toContain('Science, Technology & Ideas');
    expect(sections[0].querySelector('a[href="/reading/science-1"]')).toBeTruthy();
    expect(sections[0].textContent).toContain('90% vocab fit');
    expect(componentText()).not.toContain('Mysteries & Imagination');
    expect(componentText()).not.toContain('todavía no tiene lecturas');
  });

  it('preserves collection section while loading and shows error state with retry', () => {
    const scienceResponse = new Subject<string>();
    homeService.parseCollections.mockReturnValue([
      collection('science', 'Science, Technology & Ideas', 1),
    ]);
    homeService.listCollectionReadings.mockReturnValue(scienceResponse.asObservable());
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections'); fixture.detectChanges();

    // While loading: section is visible with loading indicator
    let sections = fixture.nativeElement.querySelectorAll('.collection-section');
    expect(sections).toHaveLength(1);
    expect(sections[0].textContent).toContain('Cargando lecturas...');

    // On error: section is visible with error message and retry button
    scienceResponse.error(new Error('Network error'));
    fixture.detectChanges();
    sections = fixture.nativeElement.querySelectorAll('.collection-section');
    expect(sections).toHaveLength(1);
    expect(sections[0].textContent).toContain('No se pudieron cargar estas lecturas');
    expect(sections[0].querySelector('button')).toBeTruthy();
  });

  it('renders collection cards with the same personalized normal and reveal states', () => {
    const scienceResponse = new Subject<string>();
    homeService.parseCollections.mockReturnValue([collection('science', 'Science', 1)]);
    homeService.listCollectionReadings.mockReturnValue(scienceResponse.asObservable());
    homeService.parseCollectionReadings.mockReturnValue(collectionPage([{
      ...collectionReading('science-1'),
      title: 'A deliberately long collection reading title that remains stable',
      progressStatus: 'IN_PROGRESS',
      coverKey: 'a-language-for-empty-rooms',
    }]));
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading(),
      { ...recommendedReading(), readingId: 'platform-2', title: 'Second story' },
    ]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections');
    scienceResponse.next('science-page'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.collection-card') as HTMLElement;
    const body = card.querySelector('.recommendation-card-body') as HTMLElement;
    const reveal = card.querySelector('.recommendation-metrics-reveal') as HTMLElement;
    const summary = card.querySelector('.reading-card-summary') as HTMLElement;
    expect(body.children[0].textContent).toContain('B1');
    expect(body.children[0].textContent).toContain('Science');
    expect(summary.textContent).toContain('90% vocab fit');
    expect(summary.textContent).not.toContain('% de vocabulario conocido');
    expect(summary.textContent).toContain('Continue reading');
    expect(reveal.classList.contains('recommendation-metrics-reveal')).toBe(true);
    expect(reveal.textContent).toContain('Compatibility 90%');
    expect(reveal.textContent).toContain('12 Known words');
    expect(reveal.textContent).toContain('2 Learning words');
    expect(reveal.textContent).toContain('8 Words to learn');
    expect(reveal.textContent).toContain('Continue reading');
    expect(reveal.textContent).not.toContain('A deliberately long collection reading title');
    expect(card.textContent?.match(/A deliberately long collection reading title that remains stable/g)).toHaveLength(1);
    expect(card.querySelector('.reading-card-title')).toBeTruthy();
    const recommendationCard = fixture.nativeElement.querySelector(
      '.recommendations-carousel app-home-reading-card'
    ) as HTMLElement;
    expect(recommendationCard.tagName).toBe(card.tagName);
    for (const selector of [
      '.reading-card-cover',
      '.reading-card-metadata',
      '.reading-card-title',
      '.reading-card-progress',
      '.reading-card-summary',
      '.recommendation-metrics-reveal',
      '.reading-card-cta',
    ]) {
      expect(recommendationCard.querySelector(selector)).toBeTruthy();
      expect(card.querySelector(selector)).toBeTruthy();
    }
    expect(
      recommendationCard.querySelector('.reading-card-primary-metric')?.textContent
    ).toBe(card.querySelector('.reading-card-primary-metric')?.textContent);
    expect(
      Array.from(recommendationCard.querySelectorAll('.reading-card-reveal-details p'))
        .map((metric) => metric.textContent)
    ).toEqual(
      Array.from(card.querySelectorAll('.reading-card-reveal-details p'))
        .map((metric) => metric.textContent)
    );
  });

  it('does not derive collections from recommendation categories', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationPage(0, 8, 8));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    homeService.parseCollections.mockReturnValue([]);
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.collection-section')).toBeFalsy();
  });

  it('isolates a listCollections failure from personalized Home content', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.error(new Error('collections')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.recommendations-carousel')).toBeTruthy();
    expect(componentText()).toContain('Recommended story');
  });

  it('paginates one collection independently, appends in order and deduplicates readingId', () => {
    const firstPage = new Subject<string>();
    const secondPage = new Subject<string>();
    homeService.parseCollections.mockReturnValue([collection('science', 'Science', 1)]);
    homeService.listCollectionReadings
      .mockReturnValueOnce(firstPage.asObservable())
      .mockReturnValueOnce(secondPage.asObservable());
    homeService.parseCollectionReadings.mockImplementation((value: string) => {
      if (value === 'page-0') return collectionPage(
        Array.from({ length: 8 }, (_, index) => collectionReading(`science-${index}`)), 0, 10
      );
      return collectionPage([
        collectionReading('science-7'), collectionReading('science-8'), collectionReading('science-9'),
      ], 1, 10);
    });
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections');
    firstPage.next('page-0'); fixture.detectChanges();
    const rail = fixture.nativeElement.querySelector('.collection-carousel') as HTMLElement;
    setCarouselGeometry(rail, 650, 400, 1200);
    rail.dispatchEvent(new Event('scroll')); rail.dispatchEvent(new Event('scroll'));
    expect(homeService.listCollectionReadings).toHaveBeenCalledTimes(2);
    expect(homeService.listCollectionReadings).toHaveBeenLastCalledWith('science', 1, 8);
    secondPage.next('page-1'); fixture.detectChanges();
    expect(fixture.componentInstance.collectionContent('science').readings.map((reading) => reading.readingId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `science-${index}`)
    );
  });

  it('keeps other Home content visible when one collection reading request fails', () => {
    homeService.parseCollections.mockReturnValue([collection('broken', 'Broken collection', 1)]);
    homeService.listCollectionReadings.mockReturnValue(throwError(() => new Error('SOAP')));
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('recommendations'); userReadingsResponse.next('users'); collectionsResponse.next('collections'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.recommendations-carousel')).toBeTruthy();
    expect(componentText()).toContain('No se pudieron cargar estas lecturas');
    expect(componentText()).toContain('Reintentar');
  });

  it('shows rail arrows only in directions that contain content', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationPage(0, 12, 12));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;

    setCarouselGeometry(carousel, 0, 400, 1200);
    carousel.dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(ariaButton('Ver recomendaciones anteriores')).toBeFalsy();
    expect(ariaButton('Ver recomendaciones siguientes')).toBeTruthy();

    carousel.scrollLeft = 300;
    carousel.dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(ariaButton('Ver recomendaciones anteriores')).toBeTruthy();
    expect(ariaButton('Ver recomendaciones siguientes')).toBeTruthy();

    carousel.scrollLeft = 800;
    carousel.dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(ariaButton('Ver recomendaciones siguientes')).toBeFalsy();

    carousel.scrollLeft = 0;
    carousel.dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(ariaButton('Ver recomendaciones anteriores')).toBeFalsy();
  });

  it('shows vocabulary fit as the primary metric and vocabulary counts in the reveal', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      { ...recommendedReading(), readingId: 'platform-2', title: 'Second story' },
    ]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.recommendation-card') as HTMLElement;
    const reveal = card.querySelector('.recommendation-metrics-reveal') as HTMLElement;
    const normalBody = card.querySelector('.recommendation-card-body') as HTMLElement;

    expect(normalBody.textContent).toContain('90% vocab fit');
    expect(normalBody.textContent).not.toContain('52% de vocabulario conocido');
    expect(normalBody.querySelector('.reading-card-summary')?.textContent).not.toContain('12 conocidas');
    expect(normalBody.textContent).toContain('Open reading');
    expect(reveal).toBeTruthy();
    expect(reveal.textContent).toContain('12 Known words');
    expect(reveal.textContent).toContain('2 Learning words');
    expect(reveal.textContent).toContain('8 Words to learn');
    expect(reveal.textContent).not.toContain('Confianza');
    expect(card.getAttribute('href')).toBe('/reading/platform-2');
  });

  it('shows a coherent zero-learning line in the shared reveal', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      { ...recommendedReading(), readingId: 'platform-2', learningWords: 0 },
    ]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector(
      '.recommendations-carousel .recommendation-card'
    ) as HTMLElement;
    expect(card.querySelector('.reading-card-summary')?.textContent).toContain('90% vocab fit');
    expect(card.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('0 Learning words');
  });

  it('keeps legacy null fit data readable without rendering an invalid percentage', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      {
        ...recommendedReading(),
        readingId: 'platform-2',
        learningWords: null,
        vocabularyFitPercentage: null,
      } as unknown as RecommendedPlatformReading,
    ]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector(
      '.recommendations-carousel .recommendation-card'
    ) as HTMLElement;
    expect(card.querySelector('.reading-card-fit-indicator')).toBeNull();
    expect(card.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('0 Learning words');
    expect(card.textContent).not.toContain('NaN');
  });

  it.each(['light', 'dark'])('keeps the recommendation summary semantic and wrapping-safe in %s mode', (theme) => {
    document.documentElement.dataset['theme'] = theme;
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading(),
      { ...recommendedReading(), readingId: 'platform-2' },
    ]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '.recommendations-carousel .reading-card-primary-metric'
    ) as HTMLElement;
    expect(summary.textContent).toContain('90% vocab fit');
    expect(summary.classList.contains('reading-card-primary-metric')).toBe(true);
    expect(summary.className).not.toContain('text-[#');
    expect(getComputedStyle(summary).overflowWrap).toBe('anywhere');
  });

  it('loads near the end, appends in backend order and blocks duplicate requests', () => {
    const secondResponse = new Subject<string>();
    homeService.recommendPlatformReadings
      .mockReturnValueOnce(recommendationResponse.asObservable())
      .mockReturnValueOnce(secondResponse.asObservable());
    homeService.parseRecommendations.mockImplementation((response: string) => {
      if (response === 'page-0') return recommendationPage(0, 12, 30);
      return recommendationPage(12, 12, 30);
    });
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges();
    recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();

    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;
    setCarouselGeometry(carousel, 650, 400, 1200);
    carousel.dispatchEvent(new Event('scroll'));
    carousel.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledTimes(2);
    expect(homeService.recommendPlatformReadings).toHaveBeenLastCalledWith(1, 12);
    expect(componentText()).toContain('Cargando más lecturas');

    secondResponse.next('page-1'); fixture.detectChanges();
    expect(fixture.componentInstance.recommendations().map((reading) => reading.readingId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `platform-${index}`)
    );
    expect(carousel.querySelectorAll('.recommendation-card')).toHaveLength(20);
    setCarouselGeometry(carousel, 1800, 400, 2200);
    carousel.dispatchEvent(new Event('scroll'));
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledTimes(2);
  });

  it('previous only scrolls back while next may start incremental loading', () => {
    const secondResponse = new Subject<string>();
    homeService.recommendPlatformReadings
      .mockReturnValueOnce(recommendationResponse.asObservable())
      .mockReturnValueOnce(secondResponse.asObservable());
    homeService.parseRecommendations.mockReturnValue(recommendationPage(0, 12, 24));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;
    setCarouselGeometry(carousel, 500, 400, 1200);
    const scrollBy = vi.fn();
    Object.defineProperty(carousel, 'scrollBy', { configurable: true, value: scrollBy });
    carousel.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    clickAriaButton('Ver recomendaciones anteriores');
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: -340 }));
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledTimes(1);

    clickAriaButton('Ver recomendaciones siguientes');
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: 340 }));
    expect(homeService.recommendPlatformReadings).toHaveBeenLastCalledWith(1, 12);
  });

  it('does not request another page when hasMore is false', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationPage(0, 6, 6));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;
    setCarouselGeometry(carousel, 600, 400, 1000);
    carousel.dispatchEvent(new Event('scroll'));
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledTimes(1);
    expect(componentText()).toContain('Fin');
  });

  it('keeps existing cards after load-more error and retries the same page', () => {
    const retryResponse = new Subject<string>();
    homeService.recommendPlatformReadings
      .mockReturnValueOnce(recommendationResponse.asObservable())
      .mockReturnValueOnce(throwError(() => new Error('SOAP')))
      .mockReturnValueOnce(retryResponse.asObservable());
    homeService.parseRecommendations.mockImplementation((response: string) =>
      response === 'page-0' ? recommendationPage(0, 12, 24) : recommendationPage(12, 12, 24)
    );
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const carousel = fixture.nativeElement.querySelector('.recommendations-carousel') as HTMLElement;
    setCarouselGeometry(carousel, 650, 400, 1200);
    carousel.dispatchEvent(new Event('scroll')); fixture.detectChanges();
    expect(fixture.componentInstance.recommendations()).toHaveLength(12);
    expect(componentText()).toContain('No pudimos cargar más lecturas');
    clickButton('Reintentar');
    expect(homeService.recommendPlatformReadings).toHaveBeenLastCalledWith(1, 12);
    retryResponse.next('page-1');
    expect(fixture.componentInstance.recommendations()).toHaveLength(20);
  });

  it('never keeps more than the first 20 backend recommendations', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationPage(0, 25, 74));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();

    expect(fixture.componentInstance.recommendations()).toHaveLength(20);
    expect(fixture.componentInstance.recommendations().map((reading) => reading.readingId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `platform-${index}`)
    );
    expect(fixture.componentInstance.recommendationsHasMore()).toBe(false);
  });

  it('does not render vertical load-more controls for short and empty initial pages', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('empty'); userReadingsResponse.next('users'); fixture.detectChanges();
    expect(componentText()).not.toContain('Ver más');
  });

  it('renders a lazy cover, uses fallback without cover and falls back on image error', () => {
    const covered = { ...recommendedReading(), coverKey:'the-camera-on-platform-three' };
    const plain = { ...recommendedReading(), readingId:'plain', title:'Plain story', coverKey:null };
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([covered, plain]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('covers'); userReadingsResponse.next('users'); fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/assets/reading-covers/the-camera-on-platform-three.webp');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(fixture.nativeElement.querySelectorAll('.cover-fallback')).toHaveLength(1);
    image.dispatchEvent(new Event('error')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.cover-fallback')).toHaveLength(2);
    expect(componentText()).toContain('90% vocab fit');
    expect(componentText()).toContain('Open reading');
  });

  it('renders Continue Reading with fallback "En progreso" and CTA without inventing fake progress or description', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-real-1', 'PLATFORM', 'In-Progress Story Without Progress Data', {
        progressPercentage: null,
        description: null,
      }),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('ok');
    continueReadingResponse.next('ok');
    fixture.detectChanges();

    const continueSection = fixture.nativeElement.querySelector('section[aria-labelledby="continue-reading-heading"]');
    expect(continueSection).toBeTruthy();
    expect(continueSection.textContent).toContain('In-Progress Story Without Progress Data');
    expect(continueSection.textContent).toContain('En progreso');
    expect(continueSection.textContent).toContain('Continuar');

    // Confirm NO fake percentage (not 62%, 38%, 27%) and NO fake description
    expect(continueSection.textContent).not.toContain('% completado');
    expect(continueSection.textContent).not.toContain('62%');
    expect(continueSection.textContent).not.toContain('38%');
    expect(continueSection.textContent).not.toContain('27%');
    expect(continueSection.querySelector('.continue-reading-progress-track')).toBeNull();
    expect(continueSection.querySelector('.continue-reading-desc')).toBeNull();
  });

  it('renders Continue Reading progress bar and description when delivered by backend', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    homeService.parseContinueReading.mockReturnValue(continueReadingPage([
      continueReadingItem('cr-real-2', 'PLATFORM', 'Story With Real Progress Data', {
        progressPercentage: 45,
        description: 'Authentic backend description.',
      }),
    ]));
    fixture.detectChanges();
    recommendationResponse.next('ok');
    continueReadingResponse.next('ok');
    fixture.detectChanges();

    const continueSection = fixture.nativeElement.querySelector('section[aria-labelledby="continue-reading-heading"]');
    expect(continueSection).toBeTruthy();
    expect(continueSection.textContent).toContain('Story With Real Progress Data');
    expect(continueSection.textContent).toContain('Authentic backend description.');
    expect(continueSection.textContent).toContain('45% completado');
    expect(continueSection.querySelector('.continue-reading-progress-track')).toBeTruthy();
    const fill = continueSection.querySelector('.continue-reading-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('45%');
  });

  function clickButton(label: string): void {
    const button = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((candidate) => candidate.textContent?.includes(label));
    button!.click();
  }

  function clickAriaButton(label: string): void {
    (fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
  }

  function ariaButton(label: string): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
  }

  function setCarouselGeometry(
    carousel: HTMLElement,
    scrollLeft: number,
    clientWidth: number,
    scrollWidth: number
  ): void {
    Object.defineProperties(carousel, {
      scrollLeft: { configurable: true, writable: true, value: scrollLeft },
      clientWidth: { configurable: true, value: clientWidth },
      scrollWidth: { configurable: true, value: scrollWidth },
    });
  }

  function recommendationPage(start: number, count: number, totalElements: number) {
    const readings = Array.from({ length: count }, (_, offset) => ({
      ...recommendedReading(),
      readingId: `platform-${start + offset}`,
      title: `Story ${start + offset}`,
      editorialLevel: start + offset === 0 ? 'C2' as const : 'A1' as const,
    }));
    return { page: Math.floor(start / 12), size: 12, totalElements, readings };
  }

  function collection(key: string, displayName: string, displayOrder: number) {
    return { key, displayName, displayOrder, description: `${displayName} description`, coverKey: null };
  }

  function collectionReading(readingId: string): RecommendedPlatformReading {
    return {
      readingId,
      title: `Collection ${readingId}`,
      language: 'en',
      editorialLevel: 'B1' as const,
      category: 'Science',
      createdAt: null,
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
    };
  }

  function collectionPage(readings: ReturnType<typeof collectionReading>[], page = 0, totalElements = readings.length) {
    return { page, size: 8, totalElements, readings };
  }

  function componentText(): string { return fixture.nativeElement.textContent; }

  function userProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
      name: 'Ada Lovelace',
      alias: null,
      age: null,
      nativeLanguage: null,
      learningLanguage: 'en',
      email: 'ada@example.com',
      ...overrides,
    };
  }

  function recommendationsPage(readings = [recommendedReading()]) {
    return { page: 0, size: 12, totalElements: readings.length, readings };
  }

  function continueReadingItem(
    readingId: string,
    origin: ReadingOrigin,
    title: string,
    overrides: Partial<ContinueReadingItem> = {}
  ): ContinueReadingItem {
    return {
      readingId,
      title,
      origin,
      progressStatus: 'IN_PROGRESS',
      coverKey: origin === 'PLATFORM' ? `${readingId}-cover` : null,
      editorialLevel: origin === 'PLATFORM' ? 'A1' : null,
      category: origin === 'PLATFORM' ? 'Daily Life' : null,
      startedAt: '2026-09-04T10:00:00',
      ...overrides,
    };
  }

  function continueReadingPage(readings: ContinueReadingItem[]) {
    return { page: 0, size: 10, totalElements: readings.length, readings };
  }

  function userReadingsPage(
    readings: UserReading[] = [
      {
        readingId: 'user-1',
        title: 'My own reading',
        language: 'en',
        createdAt: '2026-08-29T12:00:00Z',
        uniqueWords: 20,
        knownWords: 5,
        learningWords: 2,
        explicitNewWords: 1,
        ignoredWords: 3,
        unclassifiedWords: 9,
        progressStatus: null,
      },
    ]
  ) {
    return { page: 0, size: 3, totalElements: readings.length, readings };
  }

  function recommendedReading(
    overrides: Partial<RecommendedPlatformReading> = {}
  ): RecommendedPlatformReading {
    return {
      readingId: 'platform-1',
      title: 'Recommended story',
      language: 'en',
      editorialLevel: 'A1',
      category: 'Daily Life',
      createdAt: null,
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
      ...overrides,
    };
  }
});
