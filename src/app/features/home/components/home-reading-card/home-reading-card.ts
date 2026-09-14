import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecommendedPlatformReading } from '../../models/home.models';
import { coverUrl } from '../../utils/cover-url';
import { recommendationReasonCopy } from '../../utils/recommendation-reason';
import {
  resolveVocabularyFitTone,
  vocabularyFitAriaLabel,
  VocabularyFitTone,
} from '../../../../shared/utils/reading-metrics';

@Component({
  selector: 'app-home-reading-card',
  imports: [RouterLink],
  templateUrl: './home-reading-card.html',
  styleUrl: './home-reading-card.css',
})
export class HomeReadingCard {
  readonly reading = input.required<RecommendedPlatformReading>();
  readonly primaryMetric = input<string | null>(null);
  readonly secondaryMetric = input<string | null>(null);
  readonly revealMetrics = input<readonly string[]>([]);
  readonly description = input<string | null>(null);
  readonly vocabularyFitPercentage = input<number | null>(null);

  readonly imageFailed = signal(false);
  readonly imageUrl = computed(() => coverUrl(this.reading().coverKey));
  readonly reasonLabel = computed(() =>
    recommendationReasonCopy(this.reading().reasonCode)
  );
  readonly fitTone = computed<VocabularyFitTone>(() => {
    const r = this.reading();
    return resolveVocabularyFitTone({
      reasonCode: r?.reasonCode,
      classificationConfidencePercentage: r?.classificationConfidencePercentage,
    });
  });
  readonly isDiscovery = computed(() => this.fitTone() === 'discovery');
  readonly isMature = computed(() => this.fitTone() === 'mature');
  readonly isUnknown = computed(() => this.fitTone() === 'unknown');
  readonly fitAriaLabel = computed(() => vocabularyFitAriaLabel(this.fitTone()));
  readonly resolvedFitPercentage = computed(() => {
    const direct = this.vocabularyFitPercentage();
    if (direct !== null && direct !== undefined && Number.isFinite(direct)) {
      return Math.min(100, Math.max(0, Math.round(direct)));
    }
    const val = this.reading()?.vocabularyFitPercentage;
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.min(100, Math.max(0, Math.round(val)));
    }
    return null;
  });

  readonly hasFitIndicator = computed(() => {
    return this.resolvedFitPercentage() !== null;
  });

  readonly fitText = computed(() => {
    const fit = this.resolvedFitPercentage();
    return fit !== null ? `${fit}% vocab fit` : null;
  });

  readonly displayPrimaryMetric = computed(() => {
    if (this.hasFitIndicator()) return this.fitText();
    return this.primaryMetric() ?? null;
  });

  readonly resolvedRevealCompatibility = computed(() => {
    const fit = this.resolvedFitPercentage();
    if (fit !== null) return `Compatibility ${fit}%`;
    const primary = this.primaryMetric();
    if (primary) {
      return primary.replace('Compatibilidad', 'Compatibility');
    }
    return null;
  });

  readonly resolvedRevealMetrics = computed(() => {
    if (this.revealMetrics().length > 0) {
      return this.revealMetrics();
    }
    const r = this.reading();
    const known = typeof r.knownWords === 'number' ? r.knownWords : 0;
    const learning = typeof r.learningWords === 'number' ? r.learningWords : 0;
    const toLearn =
      (typeof r.explicitNewWords === 'number' ? r.explicitNewWords : 0) +
      (typeof r.unclassifiedWords === 'number' ? r.unclassifiedWords : 0);
    return [
      `${known} Known words`,
      `${learning} Learning words`,
      `${toLearn} Words to learn`,
    ];
  });

  readonly resolvedDescription = computed(() => {
    const direct = this.description();
    if (direct !== null && direct !== undefined && direct.trim() !== '') return direct;
    const r = this.reading() as { description?: string | null; summary?: string | null };
    return r.description || r.summary || null;
  });
  readonly progressLabel = computed(() => {
    const status = this.reading().progressStatus;
    if (status === 'COMPLETED') return '✓ Read';
    if (status === 'IN_PROGRESS') return 'In progress';
    return null;
  });
  readonly ctaLabel = computed(() => {
    const status = this.reading().progressStatus;
    if (status === 'COMPLETED') return 'Re-read →';
    if (status === 'IN_PROGRESS') return 'Continue reading →';
    return 'Open reading →';
  });

  markImageFailed(): void {
    this.imageFailed.set(true);
  }
}
