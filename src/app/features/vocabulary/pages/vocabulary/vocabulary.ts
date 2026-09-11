import { DatePipe, UpperCasePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { VocabularyStatus } from '../../../../shared/models/vocabulary-status';
import { ReaderToken } from '../../../../shared/models/reader-token';
import { ReaderWordPopover } from '../../../reader/components/reader-word-popover/reader-word-popover';
import { ReaderWordInteraction } from '../../../reader/services/reader-word-interaction';
import {
  UserVocabularyPage,
  VocabularyEntry,
  VocabularyFilter,
  VocabularySummary,
} from '../../models/vocabulary.models';
import { VocabularyService } from '../../services/vocabulary.service';

@Component({
  selector: 'app-vocabulary',
  imports: [ReactiveFormsModule, DatePipe, UpperCasePipe, RouterLink, ReaderWordPopover],
  providers: [ReaderWordInteraction],
  templateUrl: './vocabulary.html',
  styleUrl: './vocabulary.css',
})
export class Vocabulary implements OnInit {
  private readonly vocabularyService = inject(VocabularyService);
  readonly wordInteraction = inject(ReaderWordInteraction);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly vocabularyPage = signal<UserVocabularyPage | null>(null);
  readonly entries = signal<VocabularyEntry[]>([]);
  readonly summary = signal<VocabularySummary>({
    totalCount: 0,
    newCount: 0,
    learningCount: 0,
    knownCount: 0,
    ignoredCount: 0,
  });
  readonly totalElements = signal(0);
  readonly page = signal(0);
  readonly pageSize = 20;
  readonly selectedFilter = signal<VocabularyFilter>('ALL');
  readonly activeSearchTerm = signal('');

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalElements() / this.pageSize))
  );
  readonly hasEntries = computed(() => this.entries().length > 0);
  readonly isGlobalEmpty = computed(
    () =>
      !this.loading() &&
      !this.error() &&
      this.summary().totalCount === 0 &&
      !this.activeSearchTerm() &&
      this.selectedFilter() === 'ALL'
  );
  readonly isFilterEmpty = computed(
    () =>
      !this.loading() &&
      !this.error() &&
      this.entries().length === 0 &&
      (this.summary().totalCount > 0 ||
        !!this.activeSearchTerm() ||
        this.selectedFilter() !== 'ALL')
  );

  readonly filters: { key: VocabularyFilter; label: string }[] = [
    { key: 'ALL', label: 'Todas' },
    { key: 'NEW', label: 'Nuevas' },
    { key: 'LEARNING', label: 'Aprendiendo' },
    { key: 'KNOWN', label: 'Conocidas' },
    { key: 'IGNORED', label: 'Ignoradas' },
  ];

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        this.activeSearchTerm.set(term.trim());
        this.page.set(0);
        this.loadVocabulary();
      });

    this.loadVocabulary();
  }

  loadVocabulary(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentFilter = this.selectedFilter();
    const filter: VocabularyStatus | null =
      currentFilter === 'ALL' ? null : currentFilter;
    const search = this.activeSearchTerm();

    this.vocabularyService
      .listUserVocabulary(this.page(), this.pageSize, filter, search)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pageData) => {
          const maxPages = Math.max(
            1,
            Math.ceil(pageData.totalElements / this.pageSize)
          );
          if (pageData.totalElements > 0 && this.page() >= maxPages) {
            this.page.set(maxPages - 1);
            this.loadVocabulary();
            return;
          }

          this.vocabularyPage.set(pageData);
          this.entries.set(pageData.entries);
          this.summary.set(pageData.summary);
          this.totalElements.set(pageData.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'No pudimos cargar tu vocabulario. Intenta nuevamente.'
          );
          this.loading.set(false);
        },
      });
  }

  selectFilter(filter: VocabularyFilter): void {
    if (this.selectedFilter() === filter) return;
    this.selectedFilter.set(filter);
    this.page.set(0);
    this.loadVocabulary();
  }

  nextPage(): void {
    if (this.page() + 1 < this.totalPages() && !this.loading()) {
      this.page.update((p) => p + 1);
      this.loadVocabulary();
    }
  }

  prevPage(): void {
    if (this.page() > 0 && !this.loading()) {
      this.page.update((p) => p - 1);
      this.loadVocabulary();
    }
  }

  resetFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.activeSearchTerm.set('');
    this.selectedFilter.set('ALL');
    this.page.set(0);
    this.loadVocabulary();
  }

  openWordPopover(entry: VocabularyEntry, event: MouseEvent): void {
    const token: ReaderToken = {
      value: entry.word,
      normalizedValue: entry.word.toLowerCase(),
      type: 'WORD',
      status: entry.status,
    };
    this.wordInteraction.selectWord(token, event);
  }

  onStatusSelected(newStatus: VocabularyStatus): void {
    const selected = this.wordInteraction.selectedToken();
    if (!selected) return;

    this.wordInteraction.saveStatus(newStatus, 'en', (token, status) => {
      this.entries.update((items) =>
        items.map((item) =>
          item.word.toLowerCase() === token.value.toLowerCase()
            ? { ...item, status }
            : item
        )
      );
      this.loadVocabulary();
    });
  }

  closePopover(): void {
    this.wordInteraction.close();
  }

  getStatusLabel(status: VocabularyStatus): string {
    switch (status) {
      case 'NEW':
        return 'Nueva';
      case 'LEARNING':
        return 'Aprendiendo';
      case 'KNOWN':
        return 'Conocida';
      case 'IGNORED':
        return 'Ignorada';
    }
  }

  getStatusBadgeClass(status: VocabularyStatus): string {
    switch (status) {
      case 'NEW':
        return 'badge-new';
      case 'LEARNING':
        return 'badge-learning';
      case 'KNOWN':
        return 'badge-known';
      case 'IGNORED':
        return 'badge-ignored';
    }
  }
}
