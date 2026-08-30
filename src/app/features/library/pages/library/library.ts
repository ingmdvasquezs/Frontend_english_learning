import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserReadingsPage } from '../../models/library.models';
import { LibraryService } from '../../services/library';
import { toVocabularyCard } from '../../../../shared/utils/reading-metrics';

@Component({
  selector: 'app-library',
  imports: [DatePipe, RouterLink],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class Library implements OnInit {
  private readonly libraryService = inject(LibraryService);

  readonly readingsPage = signal<UserReadingsPage | null>(null);
  readonly readings = computed(() => this.readingsPage()?.readings ?? []);
  readonly readingCards = computed(() => this.readings().map(toVocabularyCard));
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReadings();
  }

  loadReadings(): void {
    this.loading.set(true);
    this.error.set(null);

    this.libraryService.listUserReadings().subscribe({
      next: (response) => {
        this.readingsPage.set(this.libraryService.parseUserReadings(response));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus lecturas');
        this.loading.set(false);
      },
    });
  }
}
