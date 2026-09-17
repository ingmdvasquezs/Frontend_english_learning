import { Component, ViewEncapsulation, input } from '@angular/core';
import { VocabularyFitTone } from '../../../../shared/utils/reading-metrics';

@Component({
  selector: 'app-reading-card-reveal',
  templateUrl: './reading-card-reveal.html',
  styleUrl: './reading-card-reveal.css',
  encapsulation: ViewEncapsulation.None,
})
export class ReadingCardReveal {
  readonly reason = input<string | null>(null);
  readonly compatibility = input<string | null>(null);
  readonly secondary = input<string | null>(null);
  readonly metrics = input<readonly string[]>([]);
  readonly cta = input.required<string>();
  readonly tone = input<VocabularyFitTone>('mature');
}
