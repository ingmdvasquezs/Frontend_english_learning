import { Signal } from '@angular/core';

export type NarrationState = 'IDLE' | 'PLAYING' | 'PAUSED';
export type NarrationRate = 0.75 | 1 | 1.25 | 1.5;

export const NARRATION_RATES: readonly NarrationRate[] = [0.75, 1, 1.25, 1.5];

export interface NarrationEngine {
  readonly available: Signal<boolean>;
  readonly state: Signal<NarrationState>;
  readonly rate: Signal<NarrationRate>;
  readonly currentCharacterIndex: Signal<number | null>;
  readonly followAlongAvailable: Signal<boolean>;
  play(text: string, language: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  restart(): void;
  setRate(rate: NarrationRate): void;
}
