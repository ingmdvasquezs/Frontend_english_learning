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
import { coverUrl } from '../../../home/utils/cover-url';
import { resolveHeroAssetUrl } from '../../../home/components/editorial-universe/editorial-universe';

export const NEUTRAL_LATAM_HERO_FALLBACK: string | null = null;

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
    return countries.find((c) => c.countryCode === selected) ?? countries[0];
  });

  readonly activeTopics = computed<TopicFilterOption[]>(() => {
    const country = this.activeCountry();
    if (!country) return [];
    return (country.topics ?? []).map((t) => ({
      key: t.key,
      name: t.displayName,
    }));
  });

  readonly title = computed(() => {
    if (this.isLatinAmerica()) {
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

  readonly heroImageUrl = computed(() => {
    if (this.isLatinAmerica()) {
      const country = this.activeCountry();
      const heroKey = country?.heroImages?.[0]?.assetKey;
      if (heroKey) {
        return resolveHeroAssetUrl(heroKey);
      }
      return NEUTRAL_LATAM_HERO_FALLBACK;
    }
    return coverUrl(this.collection()?.coverKey);
  });

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
    const match = normalizedParam
      ? countries.find((c) => c.countryCode.toUpperCase() === normalizedParam)
      : null;

    const validCountry = match ?? countries[0];
    this.selectedCountry.set(validCountry.countryCode);

    const firstTopic = validCountry.topics?.[0]?.key ?? null;
    this.selectedTopic.set(firstTopic);
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
    const country = this.activeCountry();
    this.selectedTopic.set(country?.topics?.[0]?.key ?? null);
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
    if (this.isLatinAmerica()) {
      const country = this.activeCountry();
      this.selectedTopic.set(country?.topics?.[0]?.key ?? null);
    }
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
}
