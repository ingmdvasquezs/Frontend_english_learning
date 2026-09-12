import { Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContinueReadingPage, ReadingCollection, RecommendedPlatformReading } from '../../models/home.models';
import { HomeService } from '../../services/home';
import {
  calculateKnownPercentage,
  calculateWordsToLearn,
  toVocabularyCard,
  wordCountLabel,
} from '../../../../shared/utils/reading-metrics';
import { coverUrl } from '../../utils/cover-url';
import { recommendationReasonCopy } from '../../utils/recommendation-reason';
import { ProfileService } from '../../../profile/services/profile';
import { userTextCoverUrl } from '../../../../shared/utils/user-text-cover';
import { HomeReadingCard } from '../../components/home-reading-card/home-reading-card';

export { calculateKnownPercentage, calculateWordsToLearn, wordCountLabel };

interface CollectionState {
  readings: RecommendedPlatformReading[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, HomeReadingCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private recommendationsCarousel?: ElementRef<HTMLElement>;
  private continueReadingCarousel?: ElementRef<HTMLElement>;
  private collectionRails?: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('recommendationsCarousel')
  set recommendationsCarouselRef(value: ElementRef<HTMLElement> | undefined) {
    this.recommendationsCarousel = value;
    if (value) queueMicrotask(() => this.updateCarouselPosition(value.nativeElement));
  }

  @ViewChild('continueReadingCarousel')
  set continueReadingCarouselRef(value: ElementRef<HTMLElement> | undefined) {
    this.continueReadingCarousel = value;
    if (value) queueMicrotask(() => this.updateContinueReadingPosition(value.nativeElement));
  }

  @ViewChildren('collectionRail')
  set collectionRailRefs(value: QueryList<ElementRef<HTMLElement>>) {
    this.collectionRails = value;
    queueMicrotask(() => this.syncCollectionPositions());
  }

  readonly recommendationsPageSize = 12;
  readonly recommendationsHomeLimit = 20;
  readonly collectionPageSize = 8;
  private readonly homeService = inject(HomeService);
  private readonly profileService = inject(ProfileService);

  readonly greeting = computed(() => {
    const profile = this.profileService.profile();
    const alias = profile?.alias?.trim();
    const firstName = profile?.name.trim().split(/\s+/)[0];
    const visibleName = alias || firstName;
    return visibleName ? `Hola, ${visibleName} 👋` : 'Hola 👋';
  });

  readonly recommendations = signal<RecommendedPlatformReading[]>([]);
  readonly recommendationsPageNumber = signal(0);
  readonly recommendationsHasMore = signal(true);
  readonly recommendationsLoadMoreLoading = signal(false);
  readonly recommendationsLoadMoreError = signal<string | null>(null);
  readonly recommendationsAtStart = signal(true);
  readonly recommendationsAtEnd = signal(false);
  readonly recommendationsHasOverflow = signal(false);
  readonly continueReadingAtStart = signal(true);
  readonly continueReadingAtEnd = signal(false);
  readonly continueReadingHasOverflow = signal(false);
  readonly failedCoverIds = signal<ReadonlySet<string>>(new Set());
  readonly userTextCoverUrl = userTextCoverUrl;
  readonly featuredRecommendationCard = computed(() => {
    const reading = this.recommendations()[0];
    if (!reading) return null;
    return {
      ...toVocabularyCard(reading),
      reasonLabel: recommendationReasonCopy(reading.reasonCode),
    };
  });
  readonly recommendationCards = computed(() =>
    this.recommendations().slice(1).map(toVocabularyCard)
  );
  readonly continueReadingPage = signal<ContinueReadingPage | null>(null);
  readonly continueReadingLoading = signal(true);
  readonly continueReadingError = signal<string | null>(null);
  readonly collections = signal<ReadingCollection[]>([]);
  readonly collectionsLoading = signal(false);
  readonly collectionsError = signal<string | null>(null);
  readonly collectionStates = signal<Readonly<Record<string, CollectionState>>>({});
  readonly collectionRailStates = signal<
    Readonly<Record<string, { atStart: boolean; atEnd: boolean; hasOverflow: boolean }>>
  >({});
  readonly continueReadingCards = computed(() => {
    const cards = (this.continueReadingPage()?.readings ?? [])
      .filter((reading) => reading.progressStatus === 'IN_PROGRESS')
      .map((reading) => ({
        ...reading,
        context:
          reading.origin === 'USER'
            ? 'Tu lectura'
            : [reading.editorialLevel, reading.category].filter(Boolean).join(' · ') || 'Platform',
      }));
    return cards.filter(
      (card, index) =>
        cards.findIndex((candidate) => candidate.readingId === card.readingId) === index
    );
  });

  readonly recommendationsLoading = signal(false);
  readonly recommendationsError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRecommendations();
    this.loadContinueReading();
    this.loadCollections();
  }

  @HostListener('window:resize')
  syncRailPositions(): void {
    const recommendations = this.recommendationsCarousel?.nativeElement;
    const continueReading = this.continueReadingCarousel?.nativeElement;
    if (recommendations) this.updateCarouselPosition(recommendations);
    if (continueReading) this.updateContinueReadingPosition(continueReading);
    this.syncCollectionPositions();
  }

  loadRecommendations(): void {
    if (this.recommendationsLoading()) return;
    this.recommendationsLoading.set(true);
    this.recommendationsError.set(null);
    this.recommendationsLoadMoreError.set(null);
    this.recommendations.set([]);
    this.recommendationsPageNumber.set(0);
    this.recommendationsHasMore.set(true);

    this.homeService.recommendPlatformReadings(0, this.recommendationsPageSize).subscribe({
      next: (response) => {
        try {
          const page = this.homeService.parseRecommendations(response);
          const readings = page.readings.slice(0, this.recommendationsHomeLimit);
          this.recommendations.set(readings);
          this.recommendationsHasMore.set(
            readings.length < this.recommendationsHomeLimit &&
            page.readings.length === this.recommendationsPageSize &&
              readings.length < page.totalElements
          );
        } catch {
          this.recommendationsError.set(
            'No se pudieron interpretar las recomendaciones'
          );
        }
        this.recommendationsLoading.set(false);
      },
      error: () => {
        this.recommendationsError.set(
          'No se pudieron cargar las recomendaciones'
        );
        this.recommendationsLoading.set(false);
      },
    });
  }

  loadMoreRecommendations(): void {
    if (
      this.recommendationsLoading() ||
      this.recommendationsLoadMoreLoading() ||
      !this.recommendationsHasMore() ||
      this.recommendations().length >= this.recommendationsHomeLimit
    ) return;

    const nextPage = this.recommendationsPageNumber() + 1;
    this.recommendationsLoadMoreLoading.set(true);
    this.recommendationsLoadMoreError.set(null);
    this.homeService
      .recommendPlatformReadings(nextPage, this.recommendationsPageSize)
      .subscribe({
        next: (response) => {
          try {
            const page = this.homeService.parseRecommendations(response);
            const existing = this.recommendations();
            const ids = new Set(existing.map((reading) => reading.readingId));
            const additions = page.readings.filter((reading) => {
              if (ids.has(reading.readingId)) return false;
              ids.add(reading.readingId);
              return true;
            });
            const merged = [...existing, ...additions].slice(
              0,
              this.recommendationsHomeLimit
            );
            this.recommendations.set(merged);
            this.recommendationsPageNumber.set(nextPage);
            this.recommendationsHasMore.set(
              merged.length < this.recommendationsHomeLimit &&
              page.readings.length === this.recommendationsPageSize &&
                merged.length < page.totalElements
            );
          } catch {
            this.recommendationsLoadMoreError.set(
              'No pudimos cargar más lecturas.'
            );
          }
          this.recommendationsLoadMoreLoading.set(false);
        },
        error: () => {
          this.recommendationsLoadMoreError.set(
            'No pudimos cargar más lecturas.'
          );
          this.recommendationsLoadMoreLoading.set(false);
        },
      });
  }

  onRecommendationsScroll(event: Event): void {
    const carousel = event.currentTarget as HTMLElement;
    this.updateCarouselPosition(carousel);

    if (this.isNearRecommendationsEnd(carousel)) {
      this.loadMoreRecommendations();
    }
  }

  scrollRecommendations(direction: 'previous' | 'next'): void {
    const carousel = this.recommendationsCarousel?.nativeElement;
    if (!carousel) return;

    const distance = Math.max(carousel.clientWidth * 0.85, 260);
    carousel.scrollBy({
      left: direction === 'previous' ? -distance : distance,
      behavior: 'smooth',
    });

    if (
      direction === 'next' &&
      this.isNearRecommendationsEnd(carousel, distance)
    ) {
      this.loadMoreRecommendations();
    }
  }

  onContinueReadingScroll(event: Event): void {
    this.updateContinueReadingPosition(event.currentTarget as HTMLElement);
  }

  scrollContinueReading(direction: 'previous' | 'next'): void {
    const carousel = this.continueReadingCarousel?.nativeElement;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction === 'previous' ? -carousel.clientWidth * 0.85 : carousel.clientWidth * 0.85,
      behavior: 'smooth',
    });
  }

  syncContinueReadingPosition(): void {
    const carousel = this.continueReadingCarousel?.nativeElement;
    if (carousel) this.updateContinueReadingPosition(carousel);
  }

  onCollectionScroll(category: string, event: Event): void {
    const carousel = event.currentTarget as HTMLElement;
    this.updateCollectionPosition(category, carousel);
    if (this.isNearRecommendationsEnd(carousel)) this.loadMoreCollection(category);
  }

  scrollCollection(collectionKey: string, carousel: HTMLElement, direction: 'previous' | 'next'): void {
    const distance = carousel.clientWidth * 0.85;
    carousel.scrollBy({
      left: direction === 'previous' ? -distance : distance,
      behavior: 'smooth',
    });
    if (direction === 'next' && this.isNearRecommendationsEnd(carousel, distance)) {
      this.loadMoreCollection(collectionKey);
    }
  }

  collectionState(category: string) {
    return this.collectionRailStates()[category] ?? {
      atStart: true,
      atEnd: true,
      hasOverflow: false,
    };
  }

  collectionContent(collectionKey: string): CollectionState {
    return this.collectionStates()[collectionKey] ?? {
      readings: [], page: 0, hasMore: false, loading: true, error: null,
    };
  }

  collectionCards(collectionKey: string) {
    return this.collectionContent(collectionKey).readings.map(toVocabularyCard);
  }

  loadCollections(): void {
    if (this.collectionsLoading()) return;
    this.collectionsLoading.set(true);
    this.collectionsError.set(null);
    this.homeService.listCollections().subscribe({
      next: (response) => {
        try {
          const collections = this.homeService.parseCollections(response);
          this.collections.set(collections);
          for (const collection of collections) this.loadCollection(collection.key, 0);
        } catch {
          this.collectionsError.set('No se pudieron interpretar las colecciones.');
        }
        this.collectionsLoading.set(false);
      },
      error: () => {
        this.collectionsError.set('No se pudieron cargar las colecciones.');
        this.collectionsLoading.set(false);
      },
    });
  }

  loadMoreCollection(collectionKey: string): void {
    const state = this.collectionContent(collectionKey);
    if (state.loading || !state.hasMore) return;
    this.loadCollection(collectionKey, state.page + 1);
  }

  retryCollection(collectionKey: string): void {
    const state = this.collectionContent(collectionKey);
    this.loadCollection(collectionKey, state.page + (state.readings.length ? 1 : 0));
  }

  private loadCollection(collectionKey: string, page: number): void {
    const current = this.collectionContent(collectionKey);
    if (current.loading && this.collectionStates()[collectionKey]) return;
    this.setCollectionContent(collectionKey, { ...current, loading: true, error: null });
    this.homeService.listCollectionReadings(collectionKey, page, this.collectionPageSize).subscribe({
      next: (response) => {
        try {
          const result = this.homeService.parseCollectionReadings(response);
          const existing = page === 0 ? [] : current.readings;
          const ids = new Set(existing.map((reading) => reading.readingId));
          const additions = result.readings.filter((reading) => {
            if (ids.has(reading.readingId)) return false;
            ids.add(reading.readingId);
            return true;
          });
          const readings = [...existing, ...additions];
          this.setCollectionContent(collectionKey, {
            readings,
            page,
            hasMore:
              result.readings.length === this.collectionPageSize &&
              readings.length < result.totalElements,
            loading: false,
            error: null,
          });
        } catch {
          this.setCollectionContent(collectionKey, {
            ...current, loading: false, error: 'No se pudieron cargar estas lecturas.',
          });
        }
      },
      error: () => this.setCollectionContent(collectionKey, {
        ...current, loading: false, error: 'No se pudieron cargar estas lecturas.',
      }),
    });
  }

  private setCollectionContent(collectionKey: string, state: CollectionState): void {
    this.collectionStates.update((states) => ({ ...states, [collectionKey]: state }));
  }

  private syncCollectionPositions(): void {
    this.collectionRails?.forEach(({ nativeElement }) => {
      const category = nativeElement.dataset['category'];
      if (category) this.updateCollectionPosition(category, nativeElement);
    });
  }

  private updateCarouselPosition(carousel: HTMLElement): void {
    const tolerance = 4;
    this.recommendationsHasOverflow.set(
      carousel.scrollWidth > carousel.clientWidth + tolerance
    );
    this.recommendationsAtStart.set(carousel.scrollLeft <= tolerance);
    this.recommendationsAtEnd.set(
      carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - tolerance
    );
  }

  private updateContinueReadingPosition(carousel: HTMLElement): void {
    const tolerance = 4;
    this.continueReadingHasOverflow.set(
      carousel.scrollWidth > carousel.clientWidth + tolerance
    );
    this.continueReadingAtStart.set(carousel.scrollLeft <= tolerance);
    this.continueReadingAtEnd.set(
      carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - tolerance
    );
  }

  private updateCollectionPosition(category: string, carousel: HTMLElement): void {
    const tolerance = 4;
    this.collectionRailStates.update((states) => ({
      ...states,
      [category]: {
        hasOverflow: carousel.scrollWidth > carousel.clientWidth + tolerance,
        atStart: carousel.scrollLeft <= tolerance,
        atEnd:
          carousel.scrollLeft + carousel.clientWidth >=
          carousel.scrollWidth - tolerance,
      },
    }));
  }

  private isNearRecommendationsEnd(
    carousel: HTMLElement,
    projectedDistance = 0
  ): boolean {
    const remaining =
      carousel.scrollWidth -
      (carousel.scrollLeft + carousel.clientWidth + projectedDistance);
    const threshold = Math.max(carousel.clientWidth * 0.5, 280);
    return remaining <= threshold;
  }

  loadContinueReading(): void {
    this.continueReadingLoading.set(true);
    this.continueReadingError.set(null);
    this.homeService.listContinueReading(0, 10).subscribe({
      next: (response) => {
        try {
          this.continueReadingPage.set(this.homeService.parseContinueReading(response));
        } catch {
          this.continueReadingError.set('No se pudieron interpretar las lecturas en progreso');
        }
        this.continueReadingLoading.set(false);
      },
      error: () => {
        this.continueReadingError.set('No se pudieron cargar las lecturas en progreso');
        this.continueReadingLoading.set(false);
      },
    });
  }

  coverUrl(coverKey: string | null): string | null {
    return coverUrl(coverKey);
  }

  markCoverFailed(readingId: string): void {
    this.failedCoverIds.update((current) => new Set(current).add(readingId));
  }
}
