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
      'Compatibilidad 90%'
    );
    expect(fixture.nativeElement.querySelector('.featured-metrics-reveal')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('My own reading');
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T12:00:00Z');
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/platform-1"]')
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.user-readings-carousel')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Mis lecturas');
    expect(fixture.nativeElement.textContent).not.toContain('Ver más');
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
    expect(componentText().match(/Continuar →/g)?.length).toBe(2);
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
    expect(componentText()).toContain('Releer →');
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
    expect(carousel.querySelectorAll('.recommendation-card')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.grid .recommendation-card')).toBeFalsy();
    expect(componentText()).not.toContain('Ver más');
  });

  it('uses backend rank one as featured and keeps the remaining rail order', () => {
    const readings = recommendationPage(0, 5, 5).readings;
    homeService.parseRecommendations.mockReturnValue(recommendationsPage(readings));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('ranked'); userReadingsResponse.next('users'); fixture.detectChanges();

    const featured = fixture.nativeElement.querySelector('.featured-recommendation') as HTMLAnchorElement;
    const railLinks = Array.from(
      fixture.nativeElement.querySelectorAll('.recommendations-carousel .recommendation-card') as NodeListOf<HTMLAnchorElement>
    );
    expect(featured.getAttribute('href')).toBe('/reading/platform-0');
    expect(featured.textContent).toContain('Story 0');
    expect(railLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/reading/platform-1', '/reading/platform-2', '/reading/platform-3', '/reading/platform-4',
    ]);
    expect(railLinks.some((link) => link.getAttribute('href') === '/reading/platform-0')).toBe(false);
  });

  it('keeps the featured cover in a controlled responsive wrapper', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([{
      ...recommendedReading(),
      coverKey: 'a-language-for-empty-rooms',
    }]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('featured'); userReadingsResponse.next('users'); fixture.detectChanges();

    const featured = fixture.nativeElement.querySelector('.featured-recommendation') as HTMLElement;
    const cover = featured.querySelector('.featured-cover') as HTMLElement;
    const image = cover.querySelector('img') as HTMLImageElement;
    expect(cover).toBeTruthy();
    expect(cover.classList.contains('aspect-video')).toBe(false);
    expect(image.classList.contains('object-cover')).toBe(true);
    expect(Array.from(featured.children).map((element) => element.classList[0])).toEqual([
      'featured-content',
      'featured-cover',
      'featured-cta',
    ]);
  });

  it('uses the shared vocabulary-card values in the featured normal and reveal states', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([recommendedReading()]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('featured'); userReadingsResponse.next('users'); fixture.detectChanges();

    const featured = fixture.nativeElement.querySelector('.featured-recommendation') as HTMLAnchorElement;
    const summary = featured.querySelector('.featured-summary') as HTMLElement;
    const reveal = featured.querySelector('.featured-metrics-reveal') as HTMLElement;
    const cta = featured.querySelector('.featured-cta') as HTMLElement;

    expect(featured.getAttribute('href')).toBe('/reading/platform-1');
    expect(summary.textContent).toContain('Compatibilidad 90%');
    expect(reveal.textContent).toContain('Compatibilidad 90%');
    expect(featured.textContent).not.toContain('% de vocabulario conocido');
    expect(reveal.textContent).toContain('12 palabras conocidas');
    expect(reveal.textContent).toContain('2 palabras que estás aprendiendo');
    expect(reveal.textContent).toContain('8 palabras por aprender');
    expect(cta.textContent).toContain('Abrir lectura');
    expect(featured.textContent?.match(/Recommended story/g)).toHaveLength(1);
    expect(featured.querySelector('.featured-content')).toBeTruthy();
    expect(featured.querySelector('.featured-cover')).toBeTruthy();
  });

  it.each([
    [31.4, 'Compatibilidad 31%'],
    [0, 'Compatibilidad 0%'],
    [null, 'Compatibilidad no disponible'],
    [undefined, 'Compatibilidad no disponible'],
    ['invalid', 'Compatibilidad no disponible'],
  ])('formats featured vocabulary fit %s through the shared helper', (value, expected) => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([{
      ...recommendedReading(),
      vocabularyFitPercentage: value,
    } as unknown as RecommendedPlatformReading]));
    fixture.detectChanges();
    recommendationResponse.next('featured');
    fixture.detectChanges();

    const featured = fixture.nativeElement.querySelector('.featured-recommendation') as HTMLElement;
    expect(featured.querySelector('.featured-summary')?.textContent).toContain(expected);
    expect(featured.querySelector('.featured-metrics-reveal')?.textContent).toContain(expected);
    expect(featured.textContent).not.toContain('% de vocabulario conocido');
    expect(featured.textContent).not.toContain('NaN');
    expect(featured.textContent).toContain('Recommended story');
    expect(featured.textContent).toContain('A1');
    expect(featured.textContent).toContain('Daily Life');
    expect(featured.textContent).toContain('Abrir lectura');
    expect(featured.querySelector('.featured-cover')).toBeTruthy();
  });

  it('renders no featured for zero recommendations and only featured for one', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('empty'); userReadingsResponse.next('users'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeFalsy();

    fixture.componentInstance.recommendations.set([recommendedReading()]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.recommendations-carousel')).toBeFalsy();
    expect(componentText()).toContain('No hay más recomendaciones');
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
    expect(sections).toHaveLength(2);
    expect(sections[0].textContent).toContain('Science, Technology & Ideas');
    expect(sections[1].textContent).toContain('Mysteries & Imagination');
    expect(sections[0].querySelector('a[href="/reading/science-1"]')).toBeTruthy();
    expect(sections[0].textContent).toContain('Compatibilidad 90%');
    expect(sections[1].textContent).toContain('todavía no tiene lecturas');
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
    expect(summary.textContent).toContain('Compatibilidad 90%');
    expect(summary.textContent).not.toContain('% de vocabulario conocido');
    expect(summary.textContent).toContain('Continuar lectura');
    expect(reveal.classList.contains('recommendation-metrics-reveal')).toBe(true);
    expect(reveal.textContent).toContain('Compatibilidad 90%');
    expect(reveal.textContent).toContain('12 palabras conocidas');
    expect(reveal.textContent).toContain('2 palabras que estás aprendiendo');
    expect(reveal.textContent).toContain('8 palabras por aprender');
    expect(reveal.textContent).toContain('Continuar lectura');
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
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeTruthy();
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
    expect(fixture.nativeElement.querySelector('.featured-recommendation')).toBeTruthy();
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
      recommendedReading(),
      { ...recommendedReading(), readingId: 'platform-2', title: 'Second story' },
    ]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); userReadingsResponse.next('users'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.recommendation-card') as HTMLElement;
    const reveal = card.querySelector('.recommendation-metrics-reveal') as HTMLElement;
    const normalBody = card.querySelector('.recommendation-card-body') as HTMLElement;

    expect(normalBody.textContent).toContain('Compatibilidad 90%');
    expect(normalBody.textContent).not.toContain('52% de vocabulario conocido');
    expect(normalBody.querySelector('.reading-card-summary')?.textContent).not.toContain('12 conocidas');
    expect(normalBody.textContent).toContain('Abrir lectura');
    expect(reveal).toBeTruthy();
    expect(reveal.textContent).toContain('12 palabras conocidas');
    expect(reveal.textContent).toContain('2 palabras que estás aprendiendo');
    expect(reveal.textContent).toContain('8 palabras por aprender');
    expect(reveal.textContent).not.toContain('Confianza');
    expect(card.getAttribute('href')).toBe('/reading/platform-2');
  });

  it('shows a coherent zero-learning line in the shared reveal', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading(),
      { ...recommendedReading(), readingId: 'platform-2', learningWords: 0 },
    ]));
    fixture.detectChanges(); recommendationResponse.next('page-0'); fixture.detectChanges();

    const card = fixture.nativeElement.querySelector(
      '.recommendations-carousel .recommendation-card'
    ) as HTMLElement;
    expect(card.querySelector('.reading-card-summary')?.textContent).toContain('Compatibilidad 90%');
    expect(card.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('0 palabras que estás aprendiendo');
  });

  it('keeps legacy null fit data readable without rendering an invalid percentage', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([
      recommendedReading(),
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
    expect(card.querySelector('.reading-card-summary')?.textContent).toContain('Compatibilidad no disponible');
    expect(card.querySelector('.recommendation-metrics-reveal')?.textContent).toContain('0 palabras que estás aprendiendo');
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
    expect(summary.textContent).toBe('Compatibilidad 90%');
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
    expect(carousel.querySelectorAll('.recommendation-card')).toHaveLength(19);
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
    expect(componentText()).toContain('Compatibilidad 90%');
    expect(componentText()).toContain('Abrir lectura');
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
    title: string
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

  function recommendedReading(): RecommendedPlatformReading {
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
    };
  }
});
