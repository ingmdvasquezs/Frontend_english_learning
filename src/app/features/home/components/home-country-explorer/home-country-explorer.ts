import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryCountrySummary } from '../../models/home.models';
import { resolveMediaUrl } from '../../../../shared/utils/media-url';

export interface CountryDisplayCard {
  countryCode: string;
  displayName: string;
  flag: string;
  readingCount: number;
  isAvailable: boolean;
  heroImage: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  CO: '🇨🇴',
  MX: '🇲🇽',
  PE: '🇵🇪',
  EC: '🇪🇨',
  AR: '🇦🇷',
  CL: '🇨🇱',
};

const DEFAULT_COUNTRY_HEROES: Record<string, string> = {
  CO: '/assets/editorial/heroes/hero-latam-colombia-valle-de-cocora.webp',
  PE: '/assets/editorial/heroes/hero-latam-peru-machu-picchu.webp',
  EC: '/assets/editorial/heroes/hero-latam-ecuador-volcan-nevado.webp',
  AR: '/assets/editorial/heroes/hero-latam-argentina-patagonia.webp',
  CL: '/assets/editorial/heroes/hero-latam-argentina-patagonia.webp',
};

const UPCOMING_COUNTRIES: Array<{ countryCode: string; displayName: string }> = [
  { countryCode: 'PE', displayName: 'Perú' },
  { countryCode: 'EC', displayName: 'Ecuador' },
  { countryCode: 'AR', displayName: 'Argentina' },
  { countryCode: 'CL', displayName: 'Chile' },
];

/**
 * Resolves a country hero asset key to a full URL.
 * Delegates to the centralized platform media resolver while preserving local fallback assets.
 */
export function resolveCountryHeroUrl(
  assetKey: string | null | undefined,
  mediaBaseUrl?: string
): string | null {
  return resolveMediaUrl(assetKey, mediaBaseUrl);
}

@Component({
  selector: 'app-home-country-explorer',
  imports: [RouterLink],
  templateUrl: './home-country-explorer.html',
  styleUrl: './home-country-explorer.css',
})
export class HomeCountryExplorer implements AfterViewInit {
  readonly countries = input<DiscoveryCountrySummary[]>([]);
  readonly defaultCountryCode = input<string>('CO');

  @ViewChild('countriesRail') countriesRailRef?: ElementRef<HTMLElement>;

  readonly railHasOverflow = signal<boolean>(false);
  readonly railAtStart = signal<boolean>(true);
  readonly railAtEnd = signal<boolean>(false);

  readonly failedImages = signal<ReadonlySet<string>>(new Set<string>());

  readonly countryCards = computed<CountryDisplayCard[]>(() => {
    const rawList = this.countries();
    const existingMap = new Map<string, DiscoveryCountrySummary>();
    for (const c of rawList) {
      existingMap.set(c.countryCode, c);
    }

    const cards: CountryDisplayCard[] = [];

    // 1. Process all backend-provided countries with real numbers
    for (const c of rawList) {
      const backendAsset = c.heroImages?.[0]?.assetKey;
      const resolvedBackendHero = backendAsset ? resolveCountryHeroUrl(backendAsset) : null;
      const hero = resolvedBackendHero ?? DEFAULT_COUNTRY_HEROES[c.countryCode] ?? '';

      cards.push({
        countryCode: c.countryCode,
        displayName: c.displayName,
        flag: COUNTRY_FLAGS[c.countryCode] ?? '🌎',
        readingCount: c.readingCount,
        isAvailable: c.readingCount > 0,
        heroImage: hero,
      });
    }

    // 2. Add upcoming countries not in backend, keeping readingCount strictly 0 (no fake numbers)
    for (const upcoming of UPCOMING_COUNTRIES) {
      if (!existingMap.has(upcoming.countryCode)) {
        cards.push({
          countryCode: upcoming.countryCode,
          displayName: upcoming.displayName,
          flag: COUNTRY_FLAGS[upcoming.countryCode] ?? '🌎',
          readingCount: 0,
          isAvailable: false,
          heroImage: DEFAULT_COUNTRY_HEROES[upcoming.countryCode] ?? '',
        });
      }
    }

    return cards;
  });

  onImageError(countryCode: string): void {
    this.failedImages.update((current) => {
      if (current.has(countryCode)) return current;
      const next = new Set(current);
      next.add(countryCode);
      return next;
    });
  }

  hasImageFailed(countryCode: string): boolean {
    return this.failedImages().has(countryCode);
  }

  constructor() {
    effect(() => {
      // Track countryCards to enforce position 0 on initial render and data reloads
      this.countryCards();
      queueMicrotask(() => {
        this.resetRailToStart();
      });
    });
  }

  ngAfterViewInit(): void {
    this.resetRailToStart();
    requestAnimationFrame(() => {
      this.resetRailToStart();
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.syncRailPosition();
  }

  resetRailToStart(): void {
    const rail = this.countriesRailRef?.nativeElement;
    if (!rail) return;
    rail.scrollLeft = 0;
    this.syncRailPosition();
  }

  syncRailPosition(): void {
    const rail = this.countriesRailRef?.nativeElement;
    if (!rail) return;
    const tolerance = 6;
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const hasOverflow = maxScroll > tolerance;
    this.railHasOverflow.set(hasOverflow);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(!hasOverflow || rail.scrollLeft >= maxScroll - tolerance);
  }

  onRailScroll(event: Event): void {
    const rail = event.currentTarget as HTMLElement;
    const tolerance = 6;
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const hasOverflow = maxScroll > tolerance;
    this.railHasOverflow.set(hasOverflow);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(!hasOverflow || rail.scrollLeft >= maxScroll - tolerance);
  }

  scrollRail(direction: 'previous' | 'next'): void {
    const rail = this.countriesRailRef?.nativeElement;
    if (!rail) return;

    const cards = Array.from(rail.querySelectorAll<HTMLElement>('.country-card'));
    if (!cards.length) return;

    const firstCard = cards[0];
    const secondCard = cards[1];
    const cardWidth = firstCard.offsetWidth || 200;
    const gap = secondCard
      ? Math.max(0, secondCard.offsetLeft - (firstCard.offsetLeft + cardWidth))
      : 14;
    const stride = cardWidth + gap;

    // How many complete cards fit in the visible area
    const visibleCards = Math.max(1, Math.floor((rail.clientWidth + gap) / stride));
    // Advance by visibleCards, but keep 1 card visible for visual context when 3+ fit
    const stepCards = Math.max(1, visibleCards >= 3 ? visibleCards - 1 : visibleCards);
    const scrollDelta = stepCards * stride;

    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const currentScroll = rail.scrollLeft;
    let targetLeft = direction === 'next'
      ? currentScroll + scrollDelta
      : currentScroll - scrollDelta;

    if (direction === 'next' && targetLeft >= maxScroll - 24) {
      targetLeft = maxScroll;
    } else if (direction === 'previous' && targetLeft <= 24) {
      targetLeft = 0;
    } else {
      const hasRenderedOffsets = cards.some((c) => c.offsetLeft > 0);
      if (hasRenderedOffsets) {
        let closestCardOffset = targetLeft;
        let minDiff = Infinity;
        for (const card of cards) {
          const diff = Math.abs(card.offsetLeft - targetLeft);
          if (diff < minDiff) {
            minDiff = diff;
            closestCardOffset = card.offsetLeft;
          }
        }
        targetLeft = Math.max(0, Math.min(maxScroll, closestCardOffset));
      } else {
        targetLeft = Math.max(0, Math.min(maxScroll, targetLeft));
      }
    }

    if (typeof rail.scrollTo === 'function') {
      rail.scrollTo({
        left: targetLeft,
        behavior: 'smooth',
      });
    } else {
      rail.scrollLeft = targetLeft;
    }

    setTimeout(() => this.syncRailPosition(), 150);
    setTimeout(() => this.syncRailPosition(), 400);
  }
}
