import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserReadingsPage } from '../../../library/models/library.models';
import { LibraryService } from '../../../library/services/library';
import { PlatformReadingRecommendationsPage } from '../../models/home.models';
import { HomeService } from '../../services/home';
import {
  calculateKnownPercentage,
  calculateWordsToLearn,
  toVocabularyCard,
  wordCountLabel,
} from '../../../../shared/utils/reading-metrics';

export { calculateKnownPercentage, calculateWordsToLearn, wordCountLabel };

@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly homeService = inject(HomeService);
  private readonly libraryService = inject(LibraryService);

  readonly recommendationsPage =
    signal<PlatformReadingRecommendationsPage | null>(null);
  readonly userReadingsPage = signal<UserReadingsPage | null>(null);

  readonly recommendations = computed(
    () => this.recommendationsPage()?.readings ?? []
  );
  readonly recommendationCards = computed(() =>
    this.recommendations().map(toVocabularyCard)
  );
  readonly userReadings = computed(
    () => this.userReadingsPage()?.readings ?? []
  );
  readonly userReadingCards = computed(() =>
    this.userReadings().map(toVocabularyCard)
  );
  readonly continueReadingCards = computed(() => {
    const cards = [
      ...this.recommendations().filter((reading) => reading.progressStatus === 'IN_PROGRESS').map((reading) => ({
        readingId: reading.readingId,
        title: reading.title,
        context: `PLATFORM · ${reading.editorialLevel}`,
      })),
      ...this.userReadings().filter((reading) => reading.progressStatus === 'IN_PROGRESS').map((reading) => ({
        readingId: reading.readingId,
        title: reading.title,
        context: 'Tu lectura',
      })),
    ];
    return cards.filter(
      (card, index) =>
        cards.findIndex((candidate) => candidate.readingId === card.readingId) === index
    );
  });

  readonly recommendationsLoading = signal(true);
  readonly userReadingsLoading = signal(true);
  readonly recommendationsError = signal<string | null>(null);
  readonly userReadingsError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRecommendations();
    this.loadUserReadings();
  }

  loadRecommendations(): void {
    this.recommendationsLoading.set(true);
    this.recommendationsError.set(null);

    this.homeService.recommendPlatformReadings(0, 4).subscribe({
      next: (response) => {
        try {
          this.recommendationsPage.set(
            this.homeService.parseRecommendations(response)
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

  loadUserReadings(): void {
    this.userReadingsLoading.set(true);
    this.userReadingsError.set(null);

    this.libraryService.listUserReadings(0, 3).subscribe({
      next: (response) => {
        try {
          this.userReadingsPage.set(
            this.libraryService.parseUserReadings(response)
          );
        } catch {
          this.userReadingsError.set('No se pudieron interpretar tus lecturas');
        }
        this.userReadingsLoading.set(false);
      },
      error: () => {
        this.userReadingsError.set('No se pudieron cargar tus lecturas');
        this.userReadingsLoading.set(false);
      },
    });
  }
}
