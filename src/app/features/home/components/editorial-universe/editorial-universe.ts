import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  COLOMBIA_EDITORIAL_PREVIEW,
  EditorialHeroImage,
  EditorialTopic,
  EditorialUniverseData,
} from '../../data/colombia-editorial-preview.data';
import { coverUrl } from '../../utils/cover-url';
import { HomeService } from '../../services/home';
import { RecommendedPlatformReading } from '../../models/home.models';
import { ReadingProgressStatus } from '../../../../shared/models/reading-progress-status';
import {
  resolveVocabularyFitTone,
  VocabularyFitTone,
} from '../../../../shared/utils/reading-metrics';
import { VocabularyFitIndicator } from '../../../../shared/components/vocabulary-fit-indicator/vocabulary-fit-indicator';
import { ReadingCardReveal } from '../reading-card-reveal/reading-card-reveal';
import { recommendationReasonCopy } from '../../utils/recommendation-reason';

export function resolveBaseCta(status?: ReadingProgressStatus | null): string {
  if (status === 'COMPLETED') return 'Re-read →';
  if (status === 'IN_PROGRESS') return 'Continue →';
  return 'Open →';
}

export function resolveRevealCta(status?: ReadingProgressStatus | null): string {
  if (status === 'COMPLETED') return 'Re-read →';
  if (status === 'IN_PROGRESS') return 'Continue reading →';
  return 'Open reading →';
}

export function resolveReadingCta(status?: ReadingProgressStatus | null): string {
  return resolveRevealCta(status);
}

export function resolveReadingFitTone(reading: RecommendedPlatformReading): VocabularyFitTone {
  return resolveVocabularyFitTone({
    reasonCode: reading.reasonCode,
    classificationConfidencePercentage: reading.classificationConfidencePercentage,
  });
}

@Component({
  selector: 'app-editorial-universe',
  imports: [RouterLink, VocabularyFitIndicator, ReadingCardReveal],
  templateUrl: './editorial-universe.html',
  styleUrl: './editorial-universe.css',
})
export class EditorialUniverse implements OnInit, AfterViewInit {
  private readonly homeService = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('storiesRail') storiesRailRef?: ElementRef<HTMLElement>;

  readonly railHasOverflow = signal<boolean>(false);
  readonly railAtStart = signal<boolean>(true);
  readonly railAtEnd = signal<boolean>(false);

  readonly universeInput = input<EditorialUniverseData>(COLOMBIA_EDITORIAL_PREVIEW);
  get universe(): EditorialUniverseData {
    return this.universeInput();
  }

  // Hero background image carousel
  readonly activeImageIndex = signal<number>(0);
  readonly isPaused = signal<boolean>(false);
  readonly heroImages = computed<EditorialHeroImage[]>(() => this.universe.heroImages ?? []);
  readonly activeImage = computed<EditorialHeroImage | null>(() => {
    const images = this.heroImages();
    return images.length > 0 ? images[this.activeImageIndex() % images.length] : null;
  });

  readonly selectedTopicId = signal<string>('myths');
  readonly previewNotice = signal<string | null>(null);

  // Cache of loaded collections: collectionKey -> RecommendedPlatformReading[]
  private readonly collectionCache = new Map<string, RecommendedPlatformReading[]>();

  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly realReadings = signal<RecommendedPlatformReading[]>([]);

  readonly selectedTopic = computed<EditorialTopic>(() => {
    const topicId = this.selectedTopicId();
    return this.universe.topics.find((t) => t.id === topicId) ?? this.universe.topics[0];
  });

  readonly isRealCollection = computed<boolean>(() => {
    return Boolean(this.selectedTopic()?.collectionKey);
  });

  ngOnInit(): void {
    this.syncTopicCollection();
    this.initHeroRotation();
  }

  ngAfterViewInit(): void {
    this.syncRailPosition();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncRailPosition();
  }

  syncRailPosition(): void {
    const rail = this.storiesRailRef?.nativeElement;
    if (!rail) return;
    const tolerance = 4;
    this.railHasOverflow.set(rail.scrollWidth > rail.clientWidth + tolerance);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(
      rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - tolerance
    );
  }

  onStoriesScroll(event: Event): void {
    const rail = event.currentTarget as HTMLElement;
    const tolerance = 4;
    this.railHasOverflow.set(rail.scrollWidth > rail.clientWidth + tolerance);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(
      rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - tolerance
    );
  }

  scrollStories(direction: 'previous' | 'next'): void {
    const rail = this.storiesRailRef?.nativeElement;
    if (!rail) return;

    const cards = Array.from(rail.querySelectorAll<HTMLElement>('.colombia-story-card'));
    if (cards.length === 0) return;

    const currentScroll = rail.scrollLeft;
    const clientWidth = rail.clientWidth;
    const tolerance = 4;

    if (direction === 'next') {
      const targetCard = cards.find(
        (c) => c.offsetLeft + c.offsetWidth > currentScroll + clientWidth + tolerance
      ) ?? cards.find((c) => c.offsetLeft >= currentScroll + clientWidth - tolerance);

      if (targetCard) {
        const maxScroll = rail.scrollWidth - clientWidth;
        const targetScroll = Math.min(targetCard.offsetLeft, maxScroll);
        if (typeof rail.scrollTo === 'function') {
          rail.scrollTo({ left: targetScroll, behavior: 'smooth' });
        } else {
          rail.scrollLeft = targetScroll;
        }
      } else {
        const endScroll = rail.scrollWidth - clientWidth;
        if (typeof rail.scrollTo === 'function') {
          rail.scrollTo({ left: endScroll, behavior: 'smooth' });
        } else {
          rail.scrollLeft = endScroll;
        }
      }
    } else {
      const targetLeft = Math.max(0, currentScroll - clientWidth);
      const targetCard = cards.slice().reverse().find(
        (c) => c.offsetLeft <= targetLeft + tolerance
      );

      if (targetCard && targetLeft > 0) {
        const prevScroll = Math.max(0, targetCard.offsetLeft);
        if (typeof rail.scrollTo === 'function') {
          rail.scrollTo({ left: prevScroll, behavior: 'smooth' });
        } else {
          rail.scrollLeft = prevScroll;
        }
      } else {
        if (typeof rail.scrollTo === 'function') {
          rail.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          rail.scrollLeft = 0;
        }
      }
    }

    setTimeout(() => this.syncRailPosition(), 350);
  }

  onBannerMouseEnter(): void {
    this.isPaused.set(true);
  }

  onBannerMouseLeave(): void {
    this.isPaused.set(false);
  }

  selectImage(index: number): void {
    this.activeImageIndex.set(index);
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private initHeroRotation(): void {
    if (typeof window === 'undefined') return;
    if (this.prefersReducedMotion()) return;
    if (this.heroImages().length <= 1) return;

    this.preloadSecondaryImages();

    const intervalId = window.setInterval(() => {
      if (!this.isPaused() && this.heroImages().length > 1) {
        this.activeImageIndex.update((idx) => (idx + 1) % this.heroImages().length);
      }
    }, 7000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
    });
  }

  private preloadSecondaryImages(): void {
    if (typeof Image === 'undefined') return;
    const images = this.heroImages();
    for (let i = 1; i < images.length; i++) {
      const img = new Image();
      img.src = images[i].src;
    }
  }

  selectTopic(topicId: string): void {
    if (this.selectedTopicId() === topicId) return;
    this.selectedTopicId.set(topicId);
    this.syncTopicCollection();
  }

  retryTopicCollection(): void {
    const topic = this.selectedTopic();
    if (topic.collectionKey) {
      this.collectionCache.delete(topic.collectionKey);
      this.loadCollection(topic.collectionKey);
    }
  }

  private syncTopicCollection(): void {
    const topic = this.selectedTopic();
    if (!topic.collectionKey) {
      this.loading.set(false);
      this.error.set(null);
      this.realReadings.set([]);
      return;
    }

    if (this.collectionCache.has(topic.collectionKey)) {
      this.realReadings.set(this.collectionCache.get(topic.collectionKey)!);
      this.loading.set(false);
      this.error.set(null);
      setTimeout(() => this.syncRailPosition(), 60);
      return;
    }

    this.loadCollection(topic.collectionKey);
  }

  private loadCollection(collectionKey: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.realReadings.set([]);

    const req$ = this.homeService.listCollectionReadings(collectionKey, 0, 20);
    if (!req$ || typeof req$.subscribe !== 'function') {
      this.loading.set(false);
      return;
    }

    req$.subscribe({
      next: (responseXml) => {
        try {
          const page = this.homeService.parseCollectionReadings(responseXml);
          this.realReadings.set(page.readings);
          this.collectionCache.set(collectionKey, page.readings);
          setTimeout(() => this.syncRailPosition(), 60);
        } catch {
          this.error.set('No se pudieron interpretar las historias de esta colección.');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las historias.');
        this.loading.set(false);
      },
    });
  }

  coverUrl(key?: string | null): string | null {
    return coverUrl(key);
  }

  fitTone(reading: RecommendedPlatformReading): VocabularyFitTone {
    return resolveReadingFitTone(reading);
  }

  fitPercentage(reading: RecommendedPlatformReading): number | null {
    const v = reading.vocabularyFitPercentage;
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.min(100, Math.max(0, Math.round(v)));
  }

  resolveBaseCta(status?: ReadingProgressStatus | null): string {
    return resolveBaseCta(status);
  }

  resolveRevealCta(status?: ReadingProgressStatus | null): string {
    return resolveRevealCta(status);
  }

  resolveCta(status?: ReadingProgressStatus | null): string {
    return resolveBaseCta(status);
  }

  resolvedCompatibility(reading: RecommendedPlatformReading): string | null {
    const fit = this.fitPercentage(reading);
    return fit !== null ? `Fit ${fit}%` : null;
  }

  resolvedRevealMetrics(reading: RecommendedPlatformReading): readonly string[] {
    const known = typeof reading.knownWords === 'number' ? reading.knownWords : 0;
    const learning = typeof reading.learningWords === 'number' ? reading.learningWords : 0;
    const toLearn =
      (typeof reading.explicitNewWords === 'number' ? reading.explicitNewWords : 0) +
      (typeof reading.unclassifiedWords === 'number' ? reading.unclassifiedWords : 0);
    return [
      `${known} Known words`,
      `${learning} Learning words`,
      `${toLearn} Words to learn`,
    ];
  }

  reasonCopy(reasonCode?: string | null): string | null {
    return recommendationReasonCopy(reasonCode);
  }

  onExploreColombia(): void {
    this.previewNotice.set(
      'La colección completa de Colombia formará parte del próximo catálogo editorial.'
    );
    setTimeout(() => {
      if (this.previewNotice()?.includes('colección completa')) {
        this.previewNotice.set(null);
      }
    }, 3500);
  }

  dismissNotice(): void {
    this.previewNotice.set(null);
  }
}
