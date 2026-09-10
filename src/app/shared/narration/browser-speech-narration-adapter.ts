import { DestroyRef, InjectionToken, Injectable, inject, signal } from '@angular/core';
import { NarrationEngine, NarrationRate, NarrationState, NARRATION_RATES } from './narration.models';

export interface NarrationVoice {
  readonly lang: string;
  readonly default: boolean;
  readonly nativeVoice: SpeechSynthesisVoice;
}

export interface NarrationUtterance {
  lang: string;
  rate: number;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onboundary: ((event: NarrationBoundaryEvent) => void) | null;
  readonly nativeUtterance: SpeechSynthesisUtterance;
}

export interface NarrationBoundaryEvent {
  readonly charIndex: number;
  readonly charLength: number;
  readonly name: string;
  readonly elapsedTime: number;
}

export interface NarrationSegment {
  readonly text: string;
  readonly startOffset: number;
}

export interface BrowserSpeechApi {
  cancel(): void;
  pause(): void;
  resume(): void;
  speak(utterance: NarrationUtterance): void;
  getVoices(): readonly NarrationVoice[];
  createUtterance(text: string): NarrationUtterance;
  listenForVoicesChanged(listener: () => void): () => void;
}

export const BROWSER_SPEECH_API = new InjectionToken<BrowserSpeechApi | null>(
  'BROWSER_SPEECH_API',
  { providedIn: 'root', factory: createBrowserSpeechApi }
);

export function segmentNarrationText(text: string, maxLength = 700): NarrationSegment[] {
  const segments: NarrationSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    if (cursor >= text.length) break;

    const limit = Math.min(cursor + maxLength, text.length);
    let end = limit;
    if (limit < text.length) end = preferredBreak(text, cursor, limit);
    while (end > cursor && /\s/.test(text[end - 1])) end -= 1;
    if (end === cursor) end = limit;

    segments.push({ text:text.slice(cursor,end), startOffset:cursor });
    cursor = Math.max(end, cursor + 1);
  }
  return segments;
}

function preferredBreak(text: string, start: number, limit: number): number {
  const candidate = text.slice(start,limit);
  let paragraphEnd = -1;
  for (const match of candidate.matchAll(/\n\s*\n/g)) paragraphEnd = match.index;
  if (paragraphEnd > 0) return start + paragraphEnd;

  let sentenceEnd = -1;
  for (const match of candidate.matchAll(/[.!?]["'”’]?(?=\s|$)/g)) sentenceEnd = match.index + match[0].length;
  if (sentenceEnd > 0) return start + sentenceEnd;

  for (let index=limit-1;index>start;index-=1) {
    if (/\s/.test(text[index])) return index;
  }
  return limit;
}

@Injectable({ providedIn: 'root' })
export class BrowserSpeechNarrationAdapter implements NarrationEngine {
  private readonly stateSignal = signal<NarrationState>('IDLE');
  private readonly rateSignal = signal<NarrationRate>(1);
  private readonly availableSignal = signal(false);
  private readonly currentCharacterIndexSignal = signal<number | null>(null);
  private readonly followAlongAvailableSignal = signal(false);
  private readonly api = inject(BROWSER_SPEECH_API);
  private readonly destroyRef = inject(DestroyRef);
  private voices: readonly NarrationVoice[] = [];
  private stopListeningForVoices = (): void => undefined;
  private segments: NarrationSegment[] = [];
  private segmentIndex = 0;
  private language = 'en';
  private sourceText: string | null = null;
  private generation = 0;
  private pendingPausedRateChange = false;

  readonly available = this.availableSignal.asReadonly();
  readonly state = this.stateSignal.asReadonly();
  readonly rate = this.rateSignal.asReadonly();
  readonly currentCharacterIndex = this.currentCharacterIndexSignal.asReadonly();
  readonly followAlongAvailable = this.followAlongAvailableSignal.asReadonly();

  constructor() {
    this.availableSignal.set(this.api !== null);
    if (this.api) {
      this.refreshVoices();
      this.stopListeningForVoices = this.api.listenForVoicesChanged(() => this.refreshVoices());
    }
    this.destroyRef.onDestroy(() => this.stopListeningForVoices());
  }

  play(text: string, language: string): void {
    if (!this.api || !text.trim()) return;

    this.cancelActivePlayback();
    this.sourceText = text;
    this.language = normalizeLanguage(language);
    this.segments = segmentNarrationText(text);
    this.segmentIndex = 0;
    this.pendingPausedRateChange = false;
    if (this.segments.length === 0) return;
    this.stateSignal.set('PLAYING');
    this.speakCurrentSegment(this.generation);
  }

  pause(): void {
    if (!this.api || this.stateSignal() !== 'PLAYING') return;
    this.api.pause();
    this.stateSignal.set('PAUSED');
  }

  resume(): void {
    if (!this.api || this.stateSignal() !== 'PAUSED') return;
    if (this.pendingPausedRateChange) {
      this.pendingPausedRateChange = false;
      this.replacePlaybackFrom(this.safeCurrentOffset());
      return;
    }
    this.api.resume();
    this.stateSignal.set('PLAYING');
  }

  stop(): void {
    this.cancelActivePlayback();
    this.sourceText = null;
    this.segments = [];
    this.segmentIndex = 0;
    this.pendingPausedRateChange = false;
  }

  restart(): void {
    if (this.sourceText) this.play(this.sourceText, this.language);
  }

  setRate(rate: NarrationRate): void {
    if (!NARRATION_RATES.includes(rate) || rate === this.rateSignal()) return;
    this.rateSignal.set(rate);
    if (this.stateSignal() === 'PLAYING') this.replacePlaybackFrom(this.safeCurrentOffset());
    else if (this.stateSignal() === 'PAUSED') this.pendingPausedRateChange = true;
  }

  private refreshVoices(): void {
    this.voices = this.api?.getVoices() ?? [];
  }

  private speakCurrentSegment(generation: number): void {
    if (!this.api || generation !== this.generation) return;
    const segment = this.segments[this.segmentIndex];
    if (!segment) {
      this.stateSignal.set('IDLE');
      this.currentCharacterIndexSignal.set(null);
      this.pendingPausedRateChange = false;
      return;
    }

    const utterance = this.api.createUtterance(segment.text);
    utterance.lang = this.language;
    utterance.rate = this.rateSignal();
    utterance.voice = selectVoice(this.voices, this.language)?.nativeVoice ?? null;
    utterance.onboundary = (event) => {
      if (generation !== this.generation || !Number.isFinite(event.charIndex)) return;
      const relativeIndex = Math.min(Math.max(0,event.charIndex),segment.text.length);
      this.followAlongAvailableSignal.set(true);
      this.currentCharacterIndexSignal.set(segment.startOffset + relativeIndex);
    };
    utterance.onend = () => {
      if (generation !== this.generation) return;
      this.segmentIndex += 1;
      if (this.segmentIndex < this.segments.length) this.speakCurrentSegment(generation);
      else {
        this.stateSignal.set('IDLE');
        this.currentCharacterIndexSignal.set(null);
        this.pendingPausedRateChange = false;
      }
    };
    utterance.onerror = () => {
      if (generation === this.generation) {
        this.stateSignal.set('IDLE');
        this.currentCharacterIndexSignal.set(null);
        this.pendingPausedRateChange = false;
      }
    };
    this.api.speak(utterance);
  }

  private cancelActivePlayback(): void {
    this.generation += 1;
    this.api?.cancel();
    this.stateSignal.set('IDLE');
    this.currentCharacterIndexSignal.set(null);
    this.followAlongAvailableSignal.set(false);
  }

  private safeCurrentOffset(): number {
    if (!this.sourceText) return 0;
    const current = this.currentCharacterIndexSignal()
      ?? this.segments[this.segmentIndex]?.startOffset
      ?? 0;
    return findSafeNarrationResumeOffset(this.sourceText, current);
  }

  private replacePlaybackFrom(resumeOffset: number): void {
    if (!this.api || !this.sourceText) return;
    this.generation += 1;
    const generation = this.generation;
    this.api.cancel();
    this.segments = segmentNarrationText(this.sourceText.slice(resumeOffset)).map((segment) => ({
      ...segment,
      startOffset: segment.startOffset + resumeOffset,
    }));
    this.segmentIndex = 0;
    this.currentCharacterIndexSignal.set(resumeOffset);
    this.stateSignal.set('PLAYING');
    if (this.segments.length > 0) this.speakCurrentSegment(generation);
    else {
      this.stateSignal.set('IDLE');
      this.currentCharacterIndexSignal.set(null);
    }
  }
}

export function findSafeNarrationResumeOffset(text: string, absoluteIndex: number): number {
  const index = Math.min(Math.max(0, absoluteIndex), text.length);
  const words = Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['\u2019][\p{L}\p{M}\p{N}]+)*/gu));
  const containing = words.find((match) => {
    const start = match.index;
    return start <= index && index < start + match[0].length;
  });
  if (containing) return containing.index;
  for (let wordIndex = words.length - 1; wordIndex >= 0; wordIndex -= 1) {
    if (words[wordIndex].index < index) return words[wordIndex].index;
  }
  return words[0]?.index ?? 0;
}

function createBrowserSpeechApi(): BrowserSpeechApi | null {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) return null;

  const synthesis = window.speechSynthesis;
  return {
    cancel: () => synthesis.cancel(),
    pause: () => synthesis.pause(),
    resume: () => synthesis.resume(),
    speak: (utterance) => synthesis.speak(utterance.nativeUtterance),
    getVoices: () => synthesis.getVoices().map((voice) => ({ lang: voice.lang, default: voice.default, nativeVoice: voice })),
    createUtterance: (text) => {
      const nativeUtterance = new SpeechSynthesisUtterance(text);
      const wrapper: NarrationUtterance = {
        get lang() { return nativeUtterance.lang; },
        set lang(value: string) { nativeUtterance.lang = value; },
        get rate() { return nativeUtterance.rate; },
        set rate(value: number) { nativeUtterance.rate = value; },
        get voice() { return nativeUtterance.voice; },
        set voice(value: SpeechSynthesisVoice | null) { nativeUtterance.voice = value; },
        get onend() { return nativeUtterance.onend as (() => void) | null; },
        set onend(value: (() => void) | null) { nativeUtterance.onend = value; },
        get onerror() { return nativeUtterance.onerror as (() => void) | null; },
        set onerror(value: (() => void) | null) { nativeUtterance.onerror = value; },
        get onboundary() { return nativeUtterance.onboundary as ((event: NarrationBoundaryEvent) => void) | null; },
        set onboundary(value: ((event: NarrationBoundaryEvent) => void) | null) { nativeUtterance.onboundary = value as ((event: SpeechSynthesisEvent) => unknown) | null; },
        nativeUtterance,
      };
      return wrapper;
    },
    listenForVoicesChanged: (listener) => {
      synthesis.addEventListener('voiceschanged', listener);
      return () => synthesis.removeEventListener('voiceschanged', listener);
    },
  };
}

function normalizeLanguage(language: string): string {
  const normalized = language.trim().replace('_', '-');
  return !normalized || normalized.toLowerCase() === 'english' ? 'en' : normalized;
}

function selectVoice(voices: readonly NarrationVoice[], language: string): NarrationVoice | undefined {
  const requested = language.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === requested)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
    ?? voices.find((voice) => voice.default);
}
