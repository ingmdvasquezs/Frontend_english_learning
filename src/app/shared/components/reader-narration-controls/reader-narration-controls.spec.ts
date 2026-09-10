import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NarrationService } from '../../narration/narration.service';
import { ReaderNarrationControls } from './reader-narration-controls';

describe('ReaderNarrationControls', () => {
  let fixture: ComponentFixture<ReaderNarrationControls>;
  const available = signal(true);
  const state = signal<'IDLE' | 'PLAYING' | 'PAUSED'>('IDLE');
  const rate = signal<0.75 | 1 | 1.25 | 1.5>(1);
  const narration = {
    available, state, rate,
    play:vi.fn(), pause:vi.fn(), resume:vi.fn(), stop:vi.fn(), restart:vi.fn(), setRate:vi.fn(),
  };

  beforeEach(async () => {
    available.set(true); state.set('IDLE'); rate.set(1); vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports:[ReaderNarrationControls],
      providers:[{provide:NarrationService,useValue:narration}],
    }).compileComponents();
    fixture=TestBed.createComponent(ReaderNarrationControls);
    fixture.componentRef.setInput('text','The visible reading.');
    fixture.componentRef.setInput('language','en-GB');
    fixture.componentRef.setInput('playLabel','Escuchar lectura');
    fixture.detectChanges();
  });

  it('shows accessible Play in IDLE and sends the supplied content', () => {
    const button = fixture.nativeElement.querySelector('.narration-launch') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Escuchar lectura');
    expect(button.querySelector('svg')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.narration-dock')).toBeFalsy();
    button.click();
    expect(narration.play).toHaveBeenCalledWith('The visible reading.','en-GB');
  });

  it('shows Pause while PLAYING and Resume while PAUSED', () => {
    state.set('PLAYING'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.narration-launch')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.narration-dock')).toBeTruthy();
    let button=fixture.nativeElement.querySelector('.narration-primary') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Pausar narración');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click(); expect(narration.pause).toHaveBeenCalledOnce();

    state.set('PAUSED'); fixture.detectChanges();
    button=fixture.nativeElement.querySelector('.narration-primary');
    expect(button.getAttribute('aria-label')).toBe('Continuar narración');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click(); expect(narration.resume).toHaveBeenCalledOnce();
  });

  it('offers restart and all supported accessible rates', () => {
    state.set('PLAYING'); fixture.detectChanges();
    (fixture.nativeElement.querySelector('.narration-restart') as HTMLButtonElement).click();
    expect(narration.restart).toHaveBeenCalledOnce();
    const select=fixture.nativeElement.querySelector('select[aria-label="Velocidad de narración"]') as HTMLSelectElement;
    expect(fixture.nativeElement.textContent).not.toContain('VELOCIDAD');
    expect(fixture.nativeElement.textContent).not.toContain('Escuchando esta parte');
    expect(fixture.nativeElement.querySelector('.narration-rate .sr-only').textContent).toContain('Velocidad');
    expect(Array.from(select.options).map((option)=>option.value)).toEqual(['0.75','1','1.25','1.5']);
    expect(select.value).toBe('1');
    select.value='1.25'; select.dispatchEvent(new Event('change'));
    expect(narration.setRate).toHaveBeenCalledWith(1.25);
  });

  it('stops and collapses through Close or natural completion', () => {
    state.set('PLAYING'); fixture.detectChanges();
    const close = fixture.nativeElement.querySelector('.narration-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toContain('detener narración');
    close.click();
    expect(narration.stop).toHaveBeenCalledOnce();

    state.set('IDLE'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.narration-dock')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.narration-launch')).toBeTruthy();
  });

  it('hides controls safely when browser narration is unavailable', () => {
    available.set(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.narration-controls')).toBeFalsy();
  });
});
