import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of, switchMap, tap, catchError, Observable } from 'rxjs';
import {
  BrowsePlatformReadingsFilters,
  DiscoveryCountrySummary,
  DiscoveryRegionOverview,
  DiscoveryTopicSummary,
  EditorialLevel,
  ReadingCollection,
  RecommendedPlatformReading,
} from '../../../home/models/home.models';
import { HomeService } from '../../../home/services/home';
import { HomeReadingCard } from '../../../home/components/home-reading-card/home-reading-card';
import {
  CollectionFilters,
  CountryFilterOption,
  TopicFilterOption,
} from '../../components/collection-filters/collection-filters';
import { resolveMediaUrl } from '../../../../shared/utils/media-url';

export const NEUTRAL_LATAM_HERO_FALLBACK =
  '/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp';

@Component({
  selector: 'app-collection-detail',
  imports: [RouterLink, HomeReadingCard, CollectionFilters],
  templateUrl: './collection-detail.html',
  styleUrl: './collection-detail.css',
})
export class CollectionDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly homeService = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = signal<string>('');
  readonly selectedCountry = signal<string | null>(null);
  readonly selectedTopic = signal<string | null>(null);
  readonly selectedLevel = signal<EditorialLevel | null>(null);
  readonly currentPage = signal<number>(0);
  readonly pageSize = 12;

  readonly latamOverview = signal<DiscoveryRegionOverview | null>(null);
  readonly collection = signal<ReadingCollection | null>(null);
  readonly collectionLoading = signal<boolean>(true);
  readonly collectionNotFound = signal<boolean>(false);

  readonly readings = signal<RecommendedPlatformReading[]>([]);
  readonly totalElements = signal<number>(0);
  readonly totalPages = signal<number>(0);
  readonly readingsLoading = signal<boolean>(false);
  readonly readingsError = signal<string | null>(null);

  readonly failedHeroImages = signal<ReadonlySet<string>>(new Set<string>());

  readonly isLatinAmerica = computed(() => this.slug() === 'latin-america');
  readonly isNew = computed(() => this.slug() === 'new');

  readonly latamCountries = computed<CountryFilterOption[]>(() => {
    return (this.latamOverview()?.countries ?? []).map((c) => ({
      code: c.countryCode,
      name: c.displayName,
    }));
  });

  readonly activeCountry = computed<DiscoveryCountrySummary | null>(() => {
    const countries = this.latamOverview()?.countries ?? [];
    if (countries.length === 0) return null;
    const selected = this.selectedCountry();
    if (!selected) return null;
    return countries.find((c) => c.countryCode.toUpperCase() === selected.toUpperCase()) ?? null;
  });

  readonly activeTopics = computed<TopicFilterOption[]>(() => {
    const country = this.activeCountry();
    if (!country) return [];
    return (country.topics ?? [])
      .filter((t) => t.readingCount > 0)
      .map((t) => ({
        key: t.key,
        name: this.getTopicName(t.key) || t.displayName,
      }));
  });

  readonly isCountryLanding = computed<boolean>(() => {
    return this.isLatinAmerica() && this.activeCountry() !== null;
  });

  readonly cefrRange = computed<string>(() => {
    const levels = this.readings()
      .map((r) => r.editorialLevel)
      .filter((lvl): lvl is EditorialLevel => Boolean(lvl));
    if (levels.length === 0) return 'A1 – C2';
    const order: EditorialLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const indices = levels.map((l) => order.indexOf(l)).filter((i) => i >= 0);
    if (indices.length === 0) return 'A1 – C2';
    const min = order[Math.min(...indices)];
    const max = order[Math.max(...indices)];
    return min === max ? min : `${min} – ${max}`;
  });

  readonly featuredTopic = computed<DiscoveryTopicSummary | null>(() => {
    const topics = (this.activeCountry()?.topics ?? []).filter((t) => t.readingCount > 0);
    if (topics.length === 0) return null;
    return [...topics].sort((a, b) => b.readingCount - a.readingCount)[0] ?? null;
  });

  readonly featuredReadings = computed<RecommendedPlatformReading[]>(() => {
    return this.readings().slice(0, 4);
  });

  readonly topicSections = computed(() => {
    const country = this.activeCountry();
    if (!country) return [];
    const allReadings = this.readings();
    return (country.topics ?? [])
      .filter((t) => t.readingCount > 0)
      .map((topic) => {
        let matchingReadings = allReadings.filter((r) => r.discoveryTopic === topic.key);
        if (
          matchingReadings.length === 0 &&
          (country.topics?.filter((t) => t.readingCount > 0).length === 1)
        ) {
          matchingReadings = allReadings;
        }
        return {
          topic,
          displayName: this.getTopicName(topic.key) || topic.displayName,
          readings: matchingReadings,
          description: this.getTopicDescription(topic.key),
        };
      });
  });

  readonly title = computed(() => {
    if (this.isLatinAmerica()) {
      const country = this.activeCountry();
      if (country) {
        return country.displayName;
      }
      return this.latamOverview()?.region.displayName ?? 'Descubre Latinoamérica';
    }
    if (this.isNew()) return 'Novedades';
    return this.collection()?.displayName ?? 'Colección editorial';
  });

  readonly description = computed(() => {
    if (this.isLatinAmerica()) {
      const country = this.activeCountry();
      return (
        country?.description ||
        country?.tagline ||
        this.latamOverview()?.region.subtitle ||
        'Historias, cultura y lugares de nuestra región.'
      );
    }
    if (this.isNew()) {
      return 'Las últimas historias añadidas a la plataforma.';
    }
    return this.collection()?.description ?? '';
  });

  readonly heroImageUrl = computed<string | null>(() => {
    if (this.isLatinAmerica()) {
      const region = this.latamOverview()?.region;
      const regionHeroKey = region?.heroKey || region?.heroImages?.[0]?.assetKey;
      const regionCandidate = regionHeroKey ? resolveMediaUrl(regionHeroKey) : null;
      const regionHeroUrl =
        (regionCandidate && !this.failedHeroImages().has(regionCandidate) ? regionCandidate : null) ??
        (!this.failedHeroImages().has(NEUTRAL_LATAM_HERO_FALLBACK) ? NEUTRAL_LATAM_HERO_FALLBACK : null);

      const country = this.activeCountry();
      if (country) {
        const countryHeroKey =
          country.heroKey ||
          country.heroImages?.[0]?.assetKey ||
          null;

        const candidateUrl = countryHeroKey ? resolveMediaUrl(countryHeroKey) : null;
        if (candidateUrl && !this.failedHeroImages().has(candidateUrl)) {
          return candidateUrl;
        }

        // Active country has no hero or its image failed -> fallback to region hero
        return regionHeroUrl;
      }

      // No country selected -> region hero
      return regionHeroUrl;
    }

    const collectionCover = resolveMediaUrl(this.collection()?.coverKey);
    if (collectionCover && !this.failedHeroImages().has(collectionCover)) {
      return collectionCover;
    }

    return null;
  });

  onHeroImageError(url: string): void {
    this.failedHeroImages.update((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  readonly countLabel = computed(() => {
    const count = this.totalElements();
    return count === 1 ? '1 historia' : `${count} historias`;
  });

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, queryParams]) => {
          const slug = params.get('slug') ?? '';
          const countryParam = queryParams.get('country');
          return this.handleRouteTransition(slug, countryParam);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private handleRouteTransition(
    slug: string,
    countryParam: string | null
  ): Observable<unknown> {
    const slugChanged = this.slug() !== slug;
    this.slug.set(slug);

    if (!slug) {
      return of(null);
    }

    if (slug === 'latin-america') {
      return this.handleLatinAmericaTransition(countryParam, slugChanged);
    }

    if (slug === 'new') {
      this.collectionLoading.set(false);
      this.collectionNotFound.set(false);
      this.currentPage.set(0);
      return this.fetchReadingsObservable();
    }

    return this.handleEditorialCollectionTransition(slug);
  }

  private handleLatinAmericaTransition(
    countryParam: string | null,
    slugChanged: boolean
  ): Observable<unknown> {
    const overview = this.latamOverview();
    if (overview && !slugChanged) {
      this.resolveLatinAmericaSelection(overview, countryParam);
      this.currentPage.set(0);
      return this.fetchReadingsObservable();
    }

    this.collectionLoading.set(true);
    this.collectionNotFound.set(false);

    return this.homeService.getDiscoveryRegionOverview('latin-america').pipe(
      tap({
        next: (xml) => {
          try {
            const parsed = this.homeService.parseDiscoveryRegionOverview(xml);
            this.latamOverview.set(parsed);
            this.resolveLatinAmericaSelection(parsed, countryParam);
            this.collectionLoading.set(false);
          } catch {
            this.collectionNotFound.set(true);
            this.collectionLoading.set(false);
          }
        },
        error: () => {
          this.collectionNotFound.set(true);
          this.collectionLoading.set(false);
        },
      }),
      switchMap(() => {
        if (this.collectionNotFound()) {
          return of(null);
        }
        this.currentPage.set(0);
        return this.fetchReadingsObservable();
      }),
      catchError(() => of(null))
    );
  }

  private resolveLatinAmericaSelection(
    overview: DiscoveryRegionOverview,
    countryParam: string | null
  ): void {
    const countries = overview.countries ?? [];
    if (countries.length === 0) {
      this.selectedCountry.set(null);
      this.selectedTopic.set(null);
      return;
    }

    const normalizedParam = countryParam?.toUpperCase().trim() ?? null;
    if (!normalizedParam) {
      this.selectedCountry.set(null);
      this.selectedTopic.set(null);
      return;
    }

    const match = countries.find((c) => c.countryCode.toUpperCase() === normalizedParam);
    const validCountry = match ?? countries[0];
    this.selectedCountry.set(validCountry.countryCode);
    this.selectedTopic.set(null);
  }

  private handleEditorialCollectionTransition(slug: string): Observable<unknown> {
    this.collectionLoading.set(true);
    this.collectionNotFound.set(false);

    return this.homeService.listCollections().pipe(
      tap({
        next: (xml) => {
          try {
            const collections = this.homeService.parseCollections(xml);
            const match = collections.find((c) => c.key === slug);
            if (match) {
              this.collection.set(match);
            } else {
              this.collectionNotFound.set(true);
            }
          } catch {
            this.collectionNotFound.set(true);
          }
          this.collectionLoading.set(false);
        },
        error: () => {
          this.collectionNotFound.set(true);
          this.collectionLoading.set(false);
        },
      }),
      switchMap(() => {
        if (this.collectionNotFound()) {
          return of(null);
        }
        this.currentPage.set(0);
        return this.fetchReadingsObservable();
      }),
      catchError(() => of(null))
    );
  }

  fetchReadingsObservable(): Observable<unknown> {
    const slug = this.slug();
    if (!slug) return of(null);

    this.readingsLoading.set(true);
    this.readingsError.set(null);

    const filters: BrowsePlatformReadingsFilters = {
      editorialLevel: this.selectedLevel(),
      page: this.currentPage(),
      size: this.pageSize,
    };

    if (this.isLatinAmerica()) {
      filters.countryCode = this.selectedCountry();
      filters.discoveryTopic = this.selectedTopic();
    } else if (this.isNew()) {
      filters.sort = 'CREATED_AT_DESC';
    } else {
      filters.collectionKey = slug;
    }

    return this.homeService.browsePlatformReadings(filters).pipe(
      tap({
        next: (responseXml) => {
          try {
            const page = this.homeService.parseBrowsePlatformReadings(responseXml);
            this.readings.set(page.readings);
            this.totalElements.set(page.totalElements);
            this.totalPages.set(Math.ceil(page.totalElements / this.pageSize));
          } catch {
            this.readingsError.set('No se pudieron interpretar las historias.');
          }
          this.readingsLoading.set(false);
        },
        error: () => {
          this.readingsError.set('No se pudieron cargar las historias de la colección.');
          this.readingsLoading.set(false);
        },
      }),
      catchError(() => {
        this.readingsLoading.set(false);
        return of(null);
      })
    );
  }

  fetchReadings(): void {
    this.fetchReadingsObservable().subscribe();
  }

  onLevelChange(level: EditorialLevel | null): void {
    if (this.selectedLevel() === level) return;
    this.selectedLevel.set(level);
    this.currentPage.set(0);
    this.fetchReadings();
  }

  onCountryChange(countryCode: string | null): void {
    if (this.selectedCountry() === countryCode) return;
    this.selectedCountry.set(countryCode);
    this.selectedTopic.set(null);
    this.currentPage.set(0);
    this.fetchReadings();
  }

  onTopicChange(topicKey: string | null): void {
    if (this.selectedTopic() === topicKey) return;
    this.selectedTopic.set(topicKey);
    this.currentPage.set(0);
    this.fetchReadings();
  }

  onClearFilters(): void {
    this.selectedLevel.set(null);
    this.selectedTopic.set(null);
    this.currentPage.set(0);
    this.fetchReadings();
  }

  onPageChange(newPage: number): void {
    if (newPage >= 0 && newPage < this.totalPages()) {
      this.currentPage.set(newPage);
      this.fetchReadings();
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    }
  }


  getTopicName(key: string): string {
    const names: Record<string, string> = {
      MYTHS_AND_LEGENDS: 'Mitos y leyendas',
      REAL_STORIES: 'Historias reales',
      HISTORY_AND_MEMORY: 'Historia y memoria',
      CULTURE_AND_TRADITIONS: 'Cultura y tradiciones',
      NATURE_AND_PLACES: 'Naturaleza y lugares',
      PEOPLE: 'Personas',
    };
    if (names[key]) return names[key];
    const found = this.activeCountry()?.topics?.find((t) => t.key === key);
    return found?.displayName || key;
  }

  getTopicDescription(key: string): string {
    const descriptions: Record<string, string> = {
      MYTHS_AND_LEGENDS: 'Relatos extraordinarios que forman parte de la tradición oral.',
      REAL_STORIES: 'Hechos y vivencias que marcaron la historia y la cultura.',
      HISTORY_AND_MEMORY: 'Hitos, transformaciones y memoria colectiva.',
      CULTURE_AND_TRADITIONS: 'Expresiones vivas, fiestas y costumbres ancestrales.',
      NATURE_AND_PLACES: 'Paisajes asombrosos, biodiversidad y geografía.',
      PEOPLE: 'Vidas fascinantes y personajes memorables.',
    };
    return descriptions[key] || 'Relatos fascinantes de su historia y cultura.';
  }

  scrollToCatalog(): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('all-stories');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}
