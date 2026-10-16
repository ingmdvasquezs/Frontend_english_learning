import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryCountrySummary } from '../../models/home.models';

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
  MX: '/assets/editorial/heroes/colombia/hero-colombia-villa-de-leyva.webp',
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

  readonly countryCards = computed<CountryDisplayCard[]>(() => {
    const rawList = this.countries();
    const existingMap = new Map<string, DiscoveryCountrySummary>();
    for (const c of rawList) {
      existingMap.set(c.countryCode, c);
    }

    const cards: CountryDisplayCard[] = [];

    // 1. Process all backend-provided countries with real numbers
    for (const c of rawList) {
      const hero = c.heroImages?.[0]?.assetKey
        ? `/assets/${c.heroImages[0].assetKey.replace(/^\/+/, '').replace(/^assets\/+/, '')}`
        : (DEFAULT_COUNTRY_HEROES[c.countryCode] ?? DEFAULT_COUNTRY_HEROES['CO']);

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
          heroImage: DEFAULT_COUNTRY_HEROES[upcoming.countryCode] ?? DEFAULT_COUNTRY_HEROES['CO'],
        });
      }
    }

    return cards;
  });

  ngAfterViewInit(): void {
    this.syncRailPosition();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.syncRailPosition();
  }

  syncRailPosition(): void {
    const rail = this.countriesRailRef?.nativeElement;
    if (!rail) return;
    const tolerance = 4;
    this.railHasOverflow.set(rail.scrollWidth > rail.clientWidth + tolerance);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(
      rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - tolerance
    );
  }

  onRailScroll(event: Event): void {
    const rail = event.currentTarget as HTMLElement;
    const tolerance = 4;
    this.railHasOverflow.set(rail.scrollWidth > rail.clientWidth + tolerance);
    this.railAtStart.set(rail.scrollLeft <= tolerance);
    this.railAtEnd.set(
      rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - tolerance
    );
  }

  scrollRail(direction: 'previous' | 'next'): void {
    const rail = this.countriesRailRef?.nativeElement;
    if (!rail) return;
    const distance = Math.max(rail.clientWidth * 0.8, 280);
    rail.scrollBy({
      left: direction === 'previous' ? -distance : distance,
      behavior: 'smooth',
    });
    setTimeout(() => this.syncRailPosition(), 350);
  }
}
