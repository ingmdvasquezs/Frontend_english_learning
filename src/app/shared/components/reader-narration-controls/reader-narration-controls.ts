import { Component, inject, input } from '@angular/core';
import { NarrationRate, NARRATION_RATES } from '../../narration/narration.models';
import { NarrationService } from '../../narration/narration.service';

@Component({
  selector: 'app-reader-narration-controls',
  templateUrl: './reader-narration-controls.html',
  styleUrl: './reader-narration-controls.css',
})
export class ReaderNarrationControls {
  readonly text = input.required<string>();
  readonly language = input.required<string>();
  readonly playLabel = input.required<string>();
  readonly narration = inject(NarrationService);
  readonly rates = NARRATION_RATES;

  togglePlayback(): void {
    if (this.narration.state() === 'PLAYING') this.narration.pause();
    else if (this.narration.state() === 'PAUSED') this.narration.resume();
    else this.narration.play(this.text(), this.language());
  }

  restart(): void {
    if (this.narration.state() === 'IDLE') this.narration.play(this.text(), this.language());
    else this.narration.restart();
  }

  close(): void {
    this.narration.stop();
  }

  changeRate(event: Event): void {
    this.narration.setRate(Number((event.target as HTMLSelectElement).value) as NarrationRate);
  }

  primaryLabel(): string {
    if (this.narration.state() === 'PLAYING') return 'Pausar narración';
    if (this.narration.state() === 'PAUSED') return 'Continuar narración';
    return this.playLabel();
  }
}
