import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DiscoveryShelfComponent } from './discovery-shelf';
import { DiscoveryShelf, RecommendedPlatformReading } from '../../models/home.models';

function mockReading(overrides: Partial<RecommendedPlatformReading> = {}): RecommendedPlatformReading {
  return {
    readingId: 'reading-shelf-1',
    title: 'Yellowstone Wonders',
    language: 'en',
    editorialLevel: 'B2',
    category: 'Nature',
    createdAt: '2026-09-15T16:00:00Z',
    uniqueWords: 250,
    knownWords: 150,
    learningWords: 20,
    explicitNewWords: 10,
    ignoredWords: 5,
    unclassifiedWords: 65,
    vocabularyFitPercentage: 80,
    classificationConfidencePercentage: 85,
    progressStatus: null,
    coverKey: 'yellowstone-cover',
    reasonCode: 'BALANCED_CHALLENGE',
    description: 'Explore the thermal wonders of Yellowstone.',
    ...overrides,
  };
}

describe('DiscoveryShelfComponent', () => {
  let fixture: ComponentFixture<DiscoveryShelfComponent>;
  let component: DiscoveryShelfComponent;

  const mockShelf: DiscoveryShelf = {
    key: 'nature-places',
    title: 'Naturaleza y Lugares',
    description: 'Historias sobre el mundo natural y paisajes asombrosos.',
    displayOrder: 1,
    coverKey: 'nature-places-cover',
    type: 'GENERIC',
    totalReadings: 5,
    readings: [
      mockReading({ readingId: 'read-1', title: 'Yellowstone Wonders' }),
      mockReading({ readingId: 'read-2', title: 'Amazon Rainforest' }),
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoveryShelfComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryShelfComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('shelf', mockShelf);
    fixture.detectChanges();
  });

  it('renders shelf title and description', () => {
    const titleEl = fixture.nativeElement.querySelector('.section-title');
    const descEl = fixture.nativeElement.querySelector('.section-subtitle');
    expect(titleEl.textContent).toContain('Naturaleza y Lugares');
    expect(descEl.textContent).toContain('Historias sobre el mundo natural');
  });

  it('renders "Ver todas" link pointing to /collections/:key', () => {
    const link = fixture.nativeElement.querySelector('.section-more-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/collections/nature-places');
    expect(link.textContent).toContain('Ver todas');
  });

  it('renders a HomeReadingCard for each reading in shelf', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-home-reading-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Yellowstone Wonders');
    expect(cards[1].textContent).toContain('Amazon Rainforest');
  });
});
