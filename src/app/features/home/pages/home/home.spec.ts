import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { LibraryService } from '../../../library/services/library';
import { HomeService } from '../../services/home';
import { RecommendedPlatformReading } from '../../models/home.models';
import { UserReading } from '../../../library/models/library.models';
import {
  Home,
  calculateKnownPercentage,
  calculateWordsToLearn,
  wordCountLabel,
} from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let recommendationResponse: Subject<string>;
  let userReadingsResponse: Subject<string>;
  let homeService: {
    recommendPlatformReadings: ReturnType<typeof vi.fn>;
    parseRecommendations: ReturnType<typeof vi.fn>;
  };
  let libraryService: {
    listUserReadings: ReturnType<typeof vi.fn>;
    parseUserReadings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recommendationResponse = new Subject<string>();
    userReadingsResponse = new Subject<string>();
    homeService = {
      recommendPlatformReadings: vi.fn(() =>
        recommendationResponse.asObservable()
      ),
      parseRecommendations: vi.fn(),
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
  });

  it('loads recommendations and the three most recent user readings', () => {
    fixture.detectChanges();

    expect(homeService.recommendPlatformReadings).toHaveBeenCalledWith(0, 4);
    expect(libraryService.listUserReadings).toHaveBeenCalledWith(0, 3);
    expect(fixture.nativeElement.textContent).toContain(
      'Cargando recomendaciones'
    );
    expect(fixture.nativeElement.textContent).toContain('Cargando tus lecturas');
  });

  it('renders recommendation and personal reading cards', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage());
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage());
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Recommended story');
    expect(fixture.nativeElement.textContent).toContain(
      '52% de vocabulario conocido'
    );
    expect(fixture.nativeElement.textContent).toContain('12 palabras conocidas');
    expect(fixture.nativeElement.textContent).toContain(
      '2 palabras que estás aprendiendo'
    );
    expect(fixture.nativeElement.textContent).toContain('8 palabras por aprender');
    expect(fixture.nativeElement.textContent).toContain('My own reading');
    expect(fixture.nativeElement.textContent).not.toContain('2026-08-29T12:00:00Z');
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/platform-1"]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('a[href="/reading/user-1"]')
    ).toBeTruthy();
  });

  it('renders both empty states', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([]));
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No hay recomendaciones disponibles'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Aún no has añadido lecturas'
    );
  });

  it('renders independent errors and retry actions', () => {
    fixture.detectChanges();
    recommendationResponse.error(new Error('recommendations failed'));
    userReadingsResponse.error(new Error('readings failed'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar las recomendaciones'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar tus lecturas'
    );
  });

  it('links to library without duplicating shell navigation', () => {
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>
    );

    expect(links.some((link) => link.getAttribute('href') === '/library')).toBe(
      true
    );
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
    expect(libraryService.listUserReadings).toHaveBeenCalledOnce();
  });

  it('builds a deduplicated continue-reading section from existing responses', () => {
    const platform = { ...recommendedReading(), progressStatus: 'IN_PROGRESS' as const };
    const user = { ...userReadingsPage().readings[0], readingId: platform.readingId, progressStatus: 'IN_PROGRESS' as const };
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([platform]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([user]));
    fixture.detectChanges();
    recommendationResponse.next('<response/>');
    userReadingsResponse.next('<response/>');
    fixture.detectChanges();
    expect(componentText().match(/Continuar →/g)?.length).toBe(1);
    expect(componentText()).toContain('En progreso');
    expect(homeService.recommendPlatformReadings).toHaveBeenCalledOnce();
    expect(libraryService.listUserReadings).toHaveBeenCalledOnce();
  });

  it('excludes completed and not-started readings from continue-reading and labels completed cards', () => {
    homeService.parseRecommendations.mockReturnValue(recommendationsPage([{ ...recommendedReading(), progressStatus: 'COMPLETED' as const }]));
    libraryService.parseUserReadings.mockReturnValue(userReadingsPage([{ ...userReadingsPage().readings[0], progressStatus: null }]));
    fixture.detectChanges(); recommendationResponse.next('x'); userReadingsResponse.next('x'); fixture.detectChanges();
    expect(componentText()).not.toContain('Continuar leyendo');
    expect(componentText()).toContain('✓ Leída');
    expect(componentText()).toContain('Releer →');
    expect(componentText()).toContain('Abrir lectura →');
  });

  function componentText(): string { return fixture.nativeElement.textContent; }

  function recommendationsPage(readings = [recommendedReading()]) {
    return { page: 0, size: 4, totalElements: readings.length, readings };
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
    };
  }
});
