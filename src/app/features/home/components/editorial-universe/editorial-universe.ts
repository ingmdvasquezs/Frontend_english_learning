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
import { UpperCasePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { coverUrl } from '../../utils/cover-url';
import { HomeService } from '../../services/home';
import {
  DiscoveryCountrySummary,
  DiscoveryHeroImage,
  DiscoveryRegionOverview,
  DiscoveryTopicSummary,
  LatinAmericaDiscovery,
  RecommendedPlatformReading,
} from '../../models/home.models';
import { ReadingProgressStatus } from '../../../../shared/models/reading-progress-status';
import {
  resolveVocabularyFitTone,
  VocabularyFitTone,
} from '../../../../shared/utils/reading-metrics';
import { VocabularyFitIndicator } from '../../../../shared/components/vocabulary-fit-indicator/vocabulary-fit-indicator';
import { ReadingCardReveal } from '../reading-card-reveal/reading-card-reveal';
import { recommendationReasonCopy } from '../../utils/recommendation-reason';

export type InteractionMode = 'AUTO' | 'USER_CONTROLLED';

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

export function resolveHeroAssetUrl(assetKey?: string | null): string {
  if (!assetKey) return '';
  if (assetKey.startsWith('http://') || assetKey.startsWith('https://')) return assetKey;
  const stripped = assetKey.replace(/^\/+/, '').replace(/^assets\/+/, '');
  return `/assets/${stripped}`;
}

export function resolveTopicIcon(topicKey?: string | null): string {
  switch (topicKey) {
    case 'MYTHS_AND_LEGENDS':
      return '🌙';
    case 'REAL_STORIES':
      return '👥';
    case 'HISTORY_AND_MEMORY':
      return '🏛️';
    case 'CULTURE_AND_TRADITIONS':
      return '👒';
    case 'NATURE_AND_PLACES':
      return '⛰️';
    case 'PEOPLE':
      return '👤';
    default:
      return '📖';
  }
}

export const COUNTRY_AUTOPLAY_MS = 5000;

/**
 * UI-only sentinel value for "no topic filter — show all readings for the country".
 * Never sent to the backend. When activeTopicKey === TOPIC_ALL_KEY, discoveryTopic
 * is omitted from browsePlatformReadings so the backend returns the full country catalog.
 */
export const TOPIC_ALL_KEY = 'ALL';

export const LATAM_COUNTRY_HERO_ASSETS: Record<string, DiscoveryHeroImage> = {
  CO: {
    assetKey: 'editorial/heroes/hero-latam-colombia-valle-de-cocora.webp',
    location: 'Valle de Cocora, Quindío',
    alt: 'Valle de Cocora, Quindío',
    displayOrder: 1,
  },
  PE: {
    assetKey: 'editorial/heroes/hero-latam-peru-machu-picchu.webp',
    location: 'Machu Picchu, Cusco',
    alt: 'Machu Picchu, Cusco',
    displayOrder: 1,
  },
  EC: {
    assetKey: 'editorial/heroes/hero-latam-ecuador-volcan-nevado.webp',
    location: 'Andes ecuatorianos',
    alt: 'Andes ecuatorianos',
    displayOrder: 1,
  },
  AR: {
    assetKey: 'editorial/heroes/hero-latam-argentina-patagonia.webp',
    location: 'Patagonia, Argentina',
    alt: 'Patagonia, Argentina',
    displayOrder: 1,
  },
};

/** Capa frontend explícita y aislada de preview visual multipaís para validar UX antes de soporte backend */
export const LATAM_VISUAL_PREVIEW_COUNTRIES: DiscoveryCountrySummary[] = [
  {
    countryCode: 'PE',
    displayName: 'Perú',
    tagline: 'Historias nacidas entre los Andes, ciudades antiguas y tradiciones que siguen vivas.',
    description: 'Historias nacidas entre los Andes, ciudades antiguas y tradiciones que siguen vivas.',
    displayOrder: 2,
    readingCount: 0,
    heroImages: [
      {
        assetKey: 'editorial/heroes/hero-latam-peru-machu-picchu.webp',
        location: 'Machu Picchu, Cusco',
        alt: 'Machu Picchu, Cusco',
        displayOrder: 1,
      },
    ],
    topics: [],
  },
  {
    countryCode: 'EC',
    displayName: 'Ecuador',
    tagline: 'Relatos entre volcanes, montañas, selvas y culturas llenas de memoria.',
    description: 'Relatos entre volcanes, montañas, selvas y culturas llenas de memoria.',
    displayOrder: 3,
    readingCount: 0,
    heroImages: [
      {
        assetKey: 'editorial/heroes/hero-latam-ecuador-volcan-nevado.webp',
        location: 'Andes ecuatorianos',
        alt: 'Andes ecuatorianos',
        displayOrder: 1,
      },
    ],
    topics: [],
  },
  {
    countryCode: 'AR',
    displayName: 'Argentina',
    tagline: 'Historias que recorren ciudades, pampas, montañas y los paisajes del sur.',
    description: 'Historias que recorren ciudades, pampas, montañas y los paisajes del sur.',
    displayOrder: 4,
    readingCount: 0,
    heroImages: [
      {
        assetKey: 'editorial/heroes/hero-latam-argentina-patagonia.webp',
        location: 'Patagonia, Argentina',
        alt: 'Patagonia, Argentina',
        displayOrder: 1,
      },
    ],
    topics: [],
  },
];

export const DEFAULT_LATAM_OVERVIEW: DiscoveryRegionOverview = {
  region: {
    key: 'latin-america',
    displayName: 'Latinoamérica',
    subtitle: 'Historias, cultura y lugares de nuestra región.',
  },
  countries: [
    {
      countryCode: 'CO',
      displayName: 'Colombia',
      tagline: 'Historias, lugares, mitos y tradiciones para aprender inglés leyendo.',
      description: 'Personas extraordinarias. Lugares inolvidables. Historias que trascienden el tiempo.',
      displayOrder: 1,
      readingCount: 15,
      heroImages: [
        {
          assetKey: 'editorial/heroes/hero-latam-colombia-valle-de-cocora.webp',
          location: 'Valle de Cocora, Quindío',
          alt: 'Valle de Cocora, Quindío',
          displayOrder: 1,
        },
        {
          assetKey: 'editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp',
          location: 'Villa de Leyva, Boyacá',
          alt: 'Villa de Leyva, Boyacá',
          displayOrder: 2,
        },
      ],
      topics: [
        {
          key: 'MYTHS_AND_LEGENDS',
          displayName: 'Mitos y leyendas',
          displayOrder: 1,
          readingCount: 15,
        },
      ],
    },
  ],
};

@Component({
  selector: 'app-editorial-universe',
  imports: [RouterLink, UpperCasePipe, VocabularyFitIndicator, ReadingCardReveal],
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

  /** Input principal desde DiscoveryHome */
  readonly latinAmerica = input<LatinAmericaDiscovery | null>(null);

  /** Opcional: permite inyectar o sobreescribir el overview desde tests */
  readonly customOverview = input<DiscoveryRegionOverview | null>(null);

  // Estado del bloque
  readonly interactionMode = signal<InteractionMode>('AUTO');
  readonly overview = signal<DiscoveryRegionOverview>(DEFAULT_LATAM_OVERVIEW);
  readonly overviewLoading = signal<boolean>(false);
  readonly overviewError = signal<string | null>(null);

  readonly activeCountryCode = signal<string>('CO');
  readonly activeTopicKey = signal<string>(TOPIC_ALL_KEY);
  readonly activeHeroImageIndex = signal<number>(0);
  readonly isHoverPaused = signal<boolean>(false);

  // Cache en memoria: key = "CO|MYTHS_AND_LEGENDS"
  private readonly readingsCache = new Map<string, RecommendedPlatformReading[]>();
  private activeRequestSub?: Subscription;

  readonly readingsLoading = signal<boolean>(false);
  readonly readingsError = signal<string | null>(null);
  readonly realReadings = signal<RecommendedPlatformReading[]>([]);

  // Computeds data-driven
  readonly effectiveOverview = computed<DiscoveryRegionOverview>(() => {
    const custom = this.customOverview();
    if (custom) return custom;
    const latam = this.latinAmerica();
    if (latam) {
      return {
        region: latam.region,
        countries: latam.countries,
      };
    }
    return this.overview();
  });

  readonly region = computed(() => this.effectiveOverview().region);
  readonly regionName = computed(() => this.region().displayName);
  readonly regionSubtitle = computed(() => this.region().subtitle);

  readonly countries = computed<DiscoveryCountrySummary[]>(() => {
    const custom = this.customOverview();
    if (custom) {
      return custom.countries;
    }
    const latam = this.latinAmerica();
    const baseCountries = latam ? latam.countries : this.overview().countries;
    const existingCodes = new Set(baseCountries.map((c) => c.countryCode));
    const preview = LATAM_VISUAL_PREVIEW_COUNTRIES.filter(
      (c) => !existingCodes.has(c.countryCode)
    );
    return [...baseCountries, ...preview].sort(
      (a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)
    );
  });

  readonly isUpcomingCountry = computed<boolean>(() => {
    const country = this.activeCountry();
    if (!country) return false;
    return country.topics.length === 0 || country.readingCount === 0;
  });

  readonly activeCountry = computed<DiscoveryCountrySummary | null>(() => {
    const list = this.countries();
    if (list.length === 0) return null;
    const code = this.activeCountryCode();
    return list.find((c) => c.countryCode === code) ?? list[0];
  });

  readonly activeTopics = computed<DiscoveryTopicSummary[]>(() => {
    return this.activeCountry()?.topics ?? [];
  });

  readonly activeTopic = computed<DiscoveryTopicSummary | null>(() => {
    const key = this.activeTopicKey();
    if (key === TOPIC_ALL_KEY) return null;
    const topics = this.activeTopics();
    if (topics.length === 0) return null;
    return topics.find((t) => t.key === key) ?? null;
  });

  readonly heroImages = computed<DiscoveryHeroImage[]>(() => {
    const country = this.activeCountry();
    if (!country) return [];
    const images = country.heroImages;
    if (images && images.length > 0) return images;
    const defaultHero = LATAM_COUNTRY_HERO_ASSETS[country.countryCode];
    return defaultHero ? [defaultHero] : [];
  });

  readonly activeHeroImage = computed<DiscoveryHeroImage | null>(() => {
    const images = this.heroImages();
    if (images.length === 0) return null;
    return images[this.activeHeroImageIndex() % images.length];
  });

  ngOnInit(): void {
    const latam = this.latinAmerica();
    if (latam) {
      this.initFromLatinAmerica(latam);
    } else {
      this.loadRegionOverview();
    }
    this.initAutoplayTimer();
  }

  private initFromLatinAmerica(latam: LatinAmericaDiscovery): void {
    const defaultCountry = latam.defaultCountryCode;
    this.activeCountryCode.set(defaultCountry);

    // Determine the initial topic key.
    // If backend provided a defaultTopicKey, honor it. Otherwise default to ALL.
    const defaultTopic = latam.defaultTopicKey ?? TOPIC_ALL_KEY;
    this.activeTopicKey.set(defaultTopic);

    // Seed the cache ONLY for the specific topic the Home preview represents.
    // IMPORTANT: Never cache the seed under COUNTRY|ALL.
    // The Home seed is a limited preview (bounded by maxShelfReadings).
    // If the user selects ALL, syncReadings() must browse the full catalog.
    if (defaultTopic !== TOPIC_ALL_KEY) {
      const cacheKey = `${defaultCountry}|${defaultTopic}`;
      this.readingsCache.set(cacheKey, latam.readings);
    }

    // Display the seed readings immediately as an optimistic initial render,
    // but syncReadings() will be called if the user later changes topic or country.
    this.realReadings.set(latam.readings);
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
    this.interactionMode.set('USER_CONTROLLED');
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
    this.isHoverPaused.set(true);
  }

  onBannerMouseLeave(): void {
    this.isHoverPaused.set(false);
  }

  selectHeroImage(index: number): void {
    this.interactionMode.set('USER_CONTROLLED');
    this.activeHeroImageIndex.set(index);
  }

  onHeroCtaClick(): void {
    this.interactionMode.set('USER_CONTROLLED');
    if (typeof document !== 'undefined') {
      const target = document.getElementById('discoveryContent');
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  onInteractiveFocus(): void {
    this.interactionMode.set('USER_CONTROLLED');
  }

  onRailTouch(): void {
    this.interactionMode.set('USER_CONTROLLED');
  }

  selectCountry(countryCode: string): void {
    this.interactionMode.set('USER_CONTROLLED');
    if (this.activeCountryCode() === countryCode) return;
    this.activeCountryCode.set(countryCode);
    this.activeHeroImageIndex.set(0);
    // Always reset topic to ALL when switching countries.
    // Topics are country-bound — inheriting a topic from the previous country
    // would silently filter content in the new country.
    this.activeTopicKey.set(TOPIC_ALL_KEY);
    this.syncReadings();
  }

  selectTopic(topicKey: string): void {
    this.interactionMode.set('USER_CONTROLLED');
    if (this.activeTopicKey() === topicKey) return;
    this.activeTopicKey.set(topicKey);
    this.syncReadings();
  }

  retryReadings(): void {
    const country = this.activeCountry();
    if (!country) return;
    const topic = this.activeTopic();
    const cacheKey = topic ? `${country.countryCode}|${topic.key}` : `${country.countryCode}|${TOPIC_ALL_KEY}`;
    this.readingsCache.delete(cacheKey);
    this.syncReadings();
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  loadRegionOverview(): void {
    this.overviewLoading.set(true);
    this.overviewError.set(null);

    this.homeService.getDiscoveryRegionOverview('latin-america').subscribe({
      next: (responseXml) => {
        try {
          const result = this.homeService.parseDiscoveryRegionOverview(responseXml);
          this.overview.set(result);
          const firstCountry = result.countries[0];
          if (firstCountry) {
            if (this.interactionMode() === 'AUTO') {
              this.activeCountryCode.set(firstCountry.countryCode);
              // Default to ALL so the user sees all readings for the country,
              // not just the first topic's subset.
              this.activeTopicKey.set(TOPIC_ALL_KEY);
            }
          }
          this.syncReadings();
        } catch {
          this.overviewError.set('No se pudo interpretar el catálogo regional.');
          this.syncReadings();
        }
        this.overviewLoading.set(false);
      },
      error: () => {
        this.overviewError.set('No se pudo cargar el catálogo regional.');
        this.overviewLoading.set(false);
        this.syncReadings();
      },
    });
  }

  private syncReadings(): void {
    const country = this.activeCountry();
    if (!country || this.isUpcomingCountry()) {
      this.activeRequestSub?.unsubscribe();
      this.realReadings.set([]);
      this.readingsLoading.set(false);
      this.readingsError.set(null);
      return;
    }

    // activeTopic() is null when activeTopicKey === TOPIC_ALL_KEY.
    // In that case, discoveryTopic is intentionally omitted from the browse call
    // so the backend returns all readings for the country.
    const topic = this.activeTopic();
    const cacheKey = topic
      ? `${country.countryCode}|${topic.key}`
      : `${country.countryCode}|${TOPIC_ALL_KEY}`;

    if (this.readingsCache.has(cacheKey)) {
      this.realReadings.set(this.readingsCache.get(cacheKey)!);
      this.readingsLoading.set(false);
      this.readingsError.set(null);
      setTimeout(() => this.syncRailPosition(), 60);
      return;
    }

    this.readingsLoading.set(true);
    this.readingsError.set(null);
    this.activeRequestSub?.unsubscribe();

    this.activeRequestSub = this.homeService
      .browsePlatformReadings({
        countryCode: country.countryCode,
        discoveryTopic: topic?.key,   // undefined when ALL — backend returns full country catalog
        page: 0,
        size: 20,
      })
      .subscribe({
        next: (responseXml) => {
          try {
            const page = this.homeService.parseBrowsePlatformReadings(responseXml);
            this.realReadings.set(page.readings);
            this.readingsCache.set(cacheKey, page.readings);
            setTimeout(() => this.syncRailPosition(), 60);
          } catch {
            this.readingsError.set('No se pudieron interpretar las historias.');
          }
          this.readingsLoading.set(false);
        },
        error: () => {
          this.readingsError.set('No se pudieron cargar las historias.');
          this.readingsLoading.set(false);
        },
      });
  }

  private initAutoplayTimer(): void {
    if (typeof window === 'undefined') return;
    if (this.prefersReducedMotion()) return;

    this.preloadImages();

    const intervalId = window.setInterval(() => {
      // If user took control or mouse is hovering, do not advance
      if (this.interactionMode() !== 'AUTO' || this.isHoverPaused()) {
        return;
      }

      const countries = this.countries();
      if (countries.length > 1) {
        // Multi-country rotation
        const currentIdx = countries.findIndex(
          (c) => c.countryCode === this.activeCountryCode()
        );
        const nextIdx = (currentIdx + 1) % countries.length;
        const nextCountry = countries[nextIdx];
        this.activeCountryCode.set(nextCountry.countryCode);
        this.activeHeroImageIndex.set(0);
        // Reset to ALL so the autoplay preview shows the full country catalog.
        this.activeTopicKey.set(TOPIC_ALL_KEY);
        this.syncReadings();
      } else {
        // Single-country rotation: rotate hero images
        const images = this.heroImages();
        if (images.length > 1) {
          this.activeHeroImageIndex.update((idx) => (idx + 1) % images.length);
        }
      }
    }, COUNTRY_AUTOPLAY_MS);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      this.activeRequestSub?.unsubscribe();
    });
  }

  private preloadImages(): void {
    if (typeof Image === 'undefined') return;
    for (const c of this.countries()) {
      const hero = c.heroImages[0] ?? LATAM_COUNTRY_HERO_ASSETS[c.countryCode];
      if (hero?.assetKey) {
        const img = new Image();
        img.src = resolveHeroAssetUrl(hero.assetKey);
      }
    }
  }

  resolveHeroSrc(assetKey?: string | null): string {
    return resolveHeroAssetUrl(assetKey);
  }

  topicIcon(key?: string | null): string {
    return resolveTopicIcon(key);
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
}
