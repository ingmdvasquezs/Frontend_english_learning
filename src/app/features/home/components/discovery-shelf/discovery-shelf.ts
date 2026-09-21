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
import { DiscoveryShelf } from '../../models/home.models';
import { HomeReadingCard } from '../home-reading-card/home-reading-card';
import { toVocabularyCard } from '../../../../shared/utils/reading-metrics';

@Component({
  selector: 'app-discovery-shelf',
  imports: [RouterLink, HomeReadingCard],
  templateUrl: './discovery-shelf.html',
  styleUrl: './discovery-shelf.css',
})
export class DiscoveryShelfComponent implements AfterViewInit {
  readonly shelf = input.required<DiscoveryShelf>();

  @ViewChild('shelfRail') shelfRailRef?: ElementRef<HTMLElement>;

  readonly railHasOverflow = signal<boolean>(false);
  readonly railAtStart = signal<boolean>(true);
  readonly railAtEnd = signal<boolean>(false);

  readonly shelfCards = computed(() =>
    this.shelf().readings.map((reading) => {
      const card = toVocabularyCard(reading);
      const fit = card.vocabularyFitPercentage;
      return {
        ...card,
        description: reading.description ?? null,
        fitLabel: fit === null ? null : `${fit}% vocab fit`,
        compatibilityLabel: fit === null ? null : `Fit ${fit}%`,
        revealMetricsEn: [
          card.knownWordsLabelEn,
          card.learningWordsLabelEn,
          card.wordsToLearnLabelEn,
        ],
      };
    })
  );

  ngAfterViewInit(): void {
    this.syncRailPosition();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncRailPosition();
  }

  syncRailPosition(): void {
    const rail = this.shelfRailRef?.nativeElement;
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
    const rail = this.shelfRailRef?.nativeElement;
    if (!rail) return;

    const distance = Math.max(rail.clientWidth * 0.85, 260);
    rail.scrollBy({
      left: direction === 'previous' ? -distance : distance,
      behavior: 'smooth',
    });

    setTimeout(() => this.syncRailPosition(), 350);
  }
}
