import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryCardItem } from './library-reading-card.models';
import { VocabularyFitIndicator } from '../../../../shared/components/vocabulary-fit-indicator/vocabulary-fit-indicator';

@Component({
  selector: 'app-library-reading-card',
  imports: [RouterLink, VocabularyFitIndicator],
  templateUrl: './library-reading-card.html',
  styleUrl: './library-reading-card.css',
})
export class LibraryReadingCard {
  readonly item = input.required<LibraryCardItem>();
  readonly isMenuOpen = input<boolean>(false);

  readonly menuToggled = output<string>();
  readonly deleteRequested = output<LibraryCardItem>();
  readonly coverError = output<LibraryCardItem>();

  readonly hasCoverError = signal<boolean>(false);

  readonly coverSrc = computed(() => {
    if (this.hasCoverError()) return null;
    return this.item().coverUrl || null;
  });

  onCoverError(): void {
    this.hasCoverError.set(true);
    this.coverError.emit(this.item());
  }

  onMenuToggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const key = this.item().actionKey || this.item().id;
    this.menuToggled.emit(key);
  }

  onDeleteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteRequested.emit(this.item());
  }

  onCardClick(event: Event): void {
    if (this.item().isUnavailable) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
