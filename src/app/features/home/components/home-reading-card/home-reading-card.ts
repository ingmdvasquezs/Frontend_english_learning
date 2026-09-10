import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecommendedPlatformReading } from '../../models/home.models';
import { coverUrl } from '../../utils/cover-url';

@Component({
  selector: 'app-home-reading-card',
  imports: [RouterLink],
  templateUrl: './home-reading-card.html',
  styleUrl: './home-reading-card.css',
})
export class HomeReadingCard {
  readonly reading = input.required<RecommendedPlatformReading>();
  readonly primaryMetric = input.required<string>();
  readonly secondaryMetric = input<string | null>(null);
  readonly revealMetrics = input<readonly string[]>([]);

  readonly imageFailed = signal(false);
  readonly imageUrl = computed(() => coverUrl(this.reading().coverKey));
  readonly progressLabel = computed(() => {
    const status = this.reading().progressStatus;
    if (status === 'COMPLETED') return '✓ Leída';
    if (status === 'IN_PROGRESS') return 'En progreso';
    return null;
  });
  readonly ctaLabel = computed(() => {
    const status = this.reading().progressStatus;
    if (status === 'COMPLETED') return 'Releer →';
    if (status === 'IN_PROGRESS') return 'Continuar lectura →';
    return 'Abrir lectura →';
  });

  markImageFailed(): void {
    this.imageFailed.set(true);
  }
}
