import { Injectable, inject } from '@angular/core';
import { BrowserSpeechNarrationAdapter } from './browser-speech-narration-adapter';
import { NarrationRate } from './narration.models';

@Injectable({ providedIn: 'root' })
export class NarrationService {
  private readonly engine = inject(BrowserSpeechNarrationAdapter);

  readonly available = this.engine.available;
  readonly state = this.engine.state;
  readonly rate = this.engine.rate;
  readonly currentCharacterIndex = this.engine.currentCharacterIndex;
  readonly followAlongAvailable = this.engine.followAlongAvailable;

  play(text: string, language: string): void { this.engine.play(text, language); }
  pause(): void { this.engine.pause(); }
  resume(): void { this.engine.resume(); }
  stop(): void { this.engine.stop(); }
  restart(): void { this.engine.restart(); }
  setRate(rate: NarrationRate): void { this.engine.setRate(rate); }
}
