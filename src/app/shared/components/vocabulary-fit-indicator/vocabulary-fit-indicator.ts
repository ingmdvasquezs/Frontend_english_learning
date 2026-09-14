import { Component, computed, input } from '@angular/core';
import { VocabularyFitTone, vocabularyFitAriaLabel } from '../../utils/reading-metrics';

@Component({
  selector: 'app-vocabulary-fit-indicator',
  templateUrl: './vocabulary-fit-indicator.html',
  styleUrl: './vocabulary-fit-indicator.css',
})
export class VocabularyFitIndicator {
  readonly percentage = input<number | null>(null);
  readonly tone = input<VocabularyFitTone>('mature');
  readonly ariaLabel = input<string | null>(null);

  readonly resolvedPercentage = computed(() => {
    const val = this.percentage();
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.min(100, Math.max(0, Math.round(val)));
    }
    return null;
  });

  readonly fitText = computed(() => {
    const pct = this.resolvedPercentage();
    return pct !== null ? `${pct}% vocab fit` : null;
  });

  readonly computedAriaLabel = computed(() => {
    const custom = this.ariaLabel();
    if (custom) return custom;
    return vocabularyFitAriaLabel(this.tone());
  });
}
