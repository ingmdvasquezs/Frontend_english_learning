import { Component, computed, input, output } from '@angular/core';
import { EditorialLevel } from '../../../home/models/home.models';

export const CANONICAL_LEVELS: readonly EditorialLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];

export interface CountryFilterOption {
  code: string;
  name: string;
}

export interface TopicFilterOption {
  key: string;
  name: string;
}

@Component({
  selector: 'app-collection-filters',
  templateUrl: './collection-filters.html',
  styleUrl: './collection-filters.css',
})
export class CollectionFilters {
  readonly selectedLevel = input<EditorialLevel | null>(null);
  readonly selectedCountry = input<string | null>(null);
  readonly countries = input<readonly CountryFilterOption[]>([]);
  readonly showCountryFilter = input<boolean>(false);

  readonly selectedTopic = input<string | null>(null);
  readonly topics = input<readonly TopicFilterOption[]>([]);
  readonly showTopicFilter = input<boolean>(false);

  readonly levelChange = output<EditorialLevel | null>();
  readonly countryChange = output<string | null>();
  readonly topicChange = output<string | null>();
  readonly clear = output<void>();

  readonly levels = CANONICAL_LEVELS;

  readonly hasActiveFilters = computed(() => {
    if (this.selectedLevel() !== null) return true;
    if (this.showTopicFilter() && this.topics().length > 0) {
      const defaultTopic = this.topics()[0].key;
      if (this.selectedTopic() !== defaultTopic) return true;
    }
    return false;
  });

  onSelectLevel(level: EditorialLevel | null): void {
    if (this.selectedLevel() !== level) {
      this.levelChange.emit(level);
    }
  }

  onSelectCountry(countryCode: string | null): void {
    if (this.selectedCountry() !== countryCode) {
      this.countryChange.emit(countryCode);
    }
  }

  onSelectTopic(topicKey: string | null): void {
    if (this.selectedTopic() !== topicKey) {
      this.topicChange.emit(topicKey);
    }
  }

  onClear(): void {
    this.clear.emit();
  }
}
