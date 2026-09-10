import { TestBed } from '@angular/core/testing';
import {
  BROWSER_SPEECH_API,
  BrowserSpeechApi,
  BrowserSpeechNarrationAdapter,
  NarrationUtterance,
  NarrationVoice,
  segmentNarrationText,
} from './browser-speech-narration-adapter';

describe('BrowserSpeechNarrationAdapter', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('creates an utterance with language, exact locale voice and selected rate', () => {
    const exact = voice('en-GB');
    const { adapter, fake } = setup([voice('en-US'), exact]);
    adapter.setRate(1.25);
    adapter.play('A complete reading.', 'en-GB');

    expect(fake.texts).toEqual(['A complete reading.']);
    expect(fake.spoken[0].lang).toBe('en-GB');
    expect(fake.spoken[0].voice).toBe(exact.nativeVoice);
    expect(fake.spoken[0].rate).toBe(1.25);
    expect(adapter.state()).toBe('PLAYING');
  });

  it('falls back to another English voice and then the browser default', () => {
    const english = voice('en-US');
    let setupResult = setup([voice('fr-FR'), english]);
    setupResult.adapter.play('Hello.', 'en-AU');
    expect(setupResult.fake.spoken[0].voice).toBe(english.nativeVoice);

    TestBed.resetTestingModule();
    const browserDefault = voice('fr-FR', true);
    setupResult = setup([browserDefault]);
    setupResult.adapter.play('Hello.', 'de-DE');
    expect(setupResult.fake.spoken[0].voice).toBe(browserDefault.nativeVoice);
  });

  it('refreshes asynchronously loaded voices after voiceschanged', () => {
    const { adapter, fake } = setup([]);
    const loaded = voice('en-US');
    fake.voices = [loaded];
    fake.emitVoicesChanged();
    adapter.play('Hello.', 'en-US');
    expect(fake.spoken[0].voice).toBe(loaded.nativeVoice);
  });

  it('pauses, resumes, stops and safely ignores invalid transitions', () => {
    const { adapter, fake } = setup([]);
    adapter.pause();
    adapter.resume();
    adapter.play('Hello.', 'en');
    adapter.pause();
    expect(adapter.state()).toBe('PAUSED');
    adapter.resume();
    expect(adapter.state()).toBe('PLAYING');
    adapter.stop();
    expect(adapter.state()).toBe('IDLE');
    expect(fake.pause).toHaveBeenCalledOnce();
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(fake.cancel).toHaveBeenCalledTimes(2);
  });

  it('restarts from the beginning and a new play cancels the old queue', () => {
    const { adapter, fake } = setup([]);
    adapter.play('First text.', 'en');
    adapter.restart();
    adapter.play('Second text.', 'en');
    expect(fake.texts).toEqual(['First text.', 'First text.', 'Second text.']);
    expect(fake.cancel).toHaveBeenCalledTimes(3);
  });

  it('segments long text and speaks every segment sequentially', () => {
    const { adapter, fake } = setup([]);
    const text = `${'First sentence. '.repeat(55)}\n\nFinal paragraph.`;
    const expected = segmentNarrationText(text);
    expect(expected.length).toBeGreaterThan(1);

    adapter.play(text, 'English');
    while (adapter.state() === 'PLAYING') fake.spoken.at(-1)?.onend?.();

    expect(fake.texts).toEqual(expected.map((segment)=>segment.text));
    expect(adapter.state()).toBe('IDLE');
    expect(fake.spoken.every((utterance) => utterance.lang === 'en')).toBe(true);
  });

  it('changes rate during PLAYING by recreating from a safe word boundary', () => {
    const { adapter, fake } = setup([]);
    adapter.setRate(0.75);
    adapter.play('Intro research continues after the boundary.', 'en');
    const oldUtterance = fake.spoken[0];
    fake.emitBoundary(9, 0);

    adapter.setRate(1.5);

    expect(fake.cancel).toHaveBeenCalledTimes(2);
    expect(fake.texts[1]).toBe('research continues after the boundary.');
    expect(fake.spoken[1].rate).toBe(1.5);
    expect(adapter.currentCharacterIndex()).toBe(6);
    expect(adapter.state()).toBe('PLAYING');

    fake.emitBoundary(9, 1);
    expect(adapter.currentCharacterIndex()).toBe(15);
    oldUtterance.onboundary?.({charIndex:0,charLength:5,name:'word',elapsedTime:0});
    oldUtterance.onend?.();
    expect(adapter.currentCharacterIndex()).toBe(15);
    expect(adapter.state()).toBe('PLAYING');
  });

  it('stores a PAUSED rate change and recreates only when Resume is requested', () => {
    const { adapter, fake } = setup([]);
    adapter.play('Alpha research continues.', 'en');
    fake.emitBoundary(8, 0);
    adapter.pause();

    adapter.setRate(1.5);
    expect(adapter.state()).toBe('PAUSED');
    expect(fake.spoken).toHaveLength(1);
    expect(fake.cancel).toHaveBeenCalledOnce();

    adapter.resume();
    expect(fake.resume).not.toHaveBeenCalled();
    expect(fake.texts[1]).toBe('research continues.');
    expect(fake.spoken[1].rate).toBe(1.5);
    expect(adapter.state()).toBe('PLAYING');
    expect(adapter.currentCharacterIndex()).toBe(6);
  });

  it('updates IDLE configuration and Restart always uses char zero with the current rate', () => {
    const { adapter, fake } = setup([]);
    adapter.setRate(1.5);
    expect(fake.spoken).toHaveLength(0);
    adapter.play('Start again here.', 'en');
    fake.emitBoundary(6, 0);
    adapter.restart();

    expect(fake.texts).toEqual(['Start again here.', 'Start again here.']);
    expect(fake.spoken[1].rate).toBe(1.5);
    expect(adapter.currentCharacterIndex()).toBeNull();
  });

  it('returns to IDLE after the final segment or an utterance error', () => {
    const { adapter, fake } = setup([]);
    adapter.play('One.', 'en');
    fake.emitBoundary(0,0);
    expect(adapter.currentCharacterIndex()).toBe(0);
    fake.spoken[0].onend?.();
    expect(adapter.state()).toBe('IDLE');
    expect(adapter.currentCharacterIndex()).toBeNull();
    adapter.play('Two.', 'en');
    fake.emitBoundary(1,0);
    fake.spoken[1].onerror?.();
    expect(adapter.state()).toBe('IDLE');
    expect(adapter.currentCharacterIndex()).toBeNull();
  });

  it('exposes a boundary relative to the first exact source segment', () => {
    const { adapter, fake } = setup([]);
    adapter.play('  Hello world.', 'en');
    fake.emitBoundary(6,0);
    expect(adapter.currentCharacterIndex()).toBe(8);
    expect(adapter.followAlongAvailable()).toBe(true);
  });

  it('adds the second segment source offset to its relative boundary', () => {
    const { adapter, fake } = setup([]);
    const text=`${'Sentence one. '.repeat(60)}Second segment word.`;
    const segments=segmentNarrationText(text);
    adapter.play(text,'en');
    fake.spoken[0].onend?.();
    fake.emitBoundary(0,1);
    expect(adapter.currentCharacterIndex()).toBe(segments[1].startOffset);
    expect(text.slice(segments[1].startOffset,segments[1].startOffset+segments[1].text.length)).toBe(segments[1].text);
  });

  it('keeps the last boundary while paused and continues with later real boundaries', () => {
    const { adapter, fake } = setup([]);
    adapter.play('Hello world.','en');
    fake.emitBoundary(0,0);
    adapter.pause();
    expect(adapter.currentCharacterIndex()).toBe(0);
    adapter.resume();
    fake.emitBoundary(6,0);
    expect(adapter.currentCharacterIndex()).toBe(6);
  });

  it('clears tracking on stop and restarts boundary offsets from the beginning', () => {
    const { adapter, fake } = setup([]);
    adapter.play('Hello world.','en'); fake.emitBoundary(6,0);
    adapter.restart();
    expect(adapter.currentCharacterIndex()).toBeNull();
    fake.emitBoundary(0,1);
    expect(adapter.currentCharacterIndex()).toBe(0);
    adapter.stop();
    expect(adapter.currentCharacterIndex()).toBeNull();
    expect(adapter.followAlongAvailable()).toBe(false);
  });

  it('keeps audio functional when the browser emits no boundary events', () => {
    const { adapter, fake } = setup([]);
    adapter.play('Audio without follow along.','en');
    expect(adapter.state()).toBe('PLAYING');
    expect(adapter.followAlongAvailable()).toBe(false);
    expect(adapter.currentCharacterIndex()).toBeNull();
    fake.spoken[0].onend?.();
    expect(adapter.state()).toBe('IDLE');
  });

  it('is unavailable without a browser speech API and never throws', () => {
    TestBed.configureTestingModule({ providers: [{ provide: BROWSER_SPEECH_API, useValue: null }] });
    const adapter = TestBed.inject(BrowserSpeechNarrationAdapter);
    expect(adapter.available()).toBe(false);
    expect(() => {
      adapter.play('Hello', 'en'); adapter.pause(); adapter.resume(); adapter.restart(); adapter.stop();
    }).not.toThrow();
    expect(adapter.state()).toBe('IDLE');
  });

  function setup(voices: NarrationVoice[]) {
    const fake = new FakeBrowserSpeechApi(voices);
    TestBed.configureTestingModule({ providers: [{ provide: BROWSER_SPEECH_API, useValue: fake }] });
    return { adapter: TestBed.inject(BrowserSpeechNarrationAdapter), fake };
  }

  function voice(lang: string, isDefault = false): NarrationVoice {
    return { lang, default: isDefault, nativeVoice: { lang, default: isDefault } as SpeechSynthesisVoice };
  }
});

class FakeBrowserSpeechApi implements BrowserSpeechApi {
  readonly cancel = vi.fn();
  readonly pause = vi.fn();
  readonly resume = vi.fn();
  readonly spoken: NarrationUtterance[] = [];
  readonly texts: string[] = [];
  voicesChanged: (() => void) | null = null;

  constructor(public voices: NarrationVoice[]) {}
  speak(utterance: NarrationUtterance): void { this.spoken.push(utterance); }
  getVoices(): readonly NarrationVoice[] { return this.voices; }
  createUtterance(text: string): NarrationUtterance {
    this.texts.push(text);
    return { lang:'', rate:1, voice:null, onend:null, onerror:null, onboundary:null, nativeUtterance:{} as SpeechSynthesisUtterance };
  }
  listenForVoicesChanged(listener: () => void): () => void {
    this.voicesChanged = listener;
    return () => { this.voicesChanged = null; };
  }
  emitVoicesChanged(): void { this.voicesChanged?.(); }
  emitBoundary(charIndex:number,utteranceIndex:number): void {
    this.spoken[utteranceIndex].onboundary?.({charIndex,charLength:0,name:'word',elapsedTime:0});
  }
}
