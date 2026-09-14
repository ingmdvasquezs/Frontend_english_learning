import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { VocabularyFitIndicator } from './vocabulary-fit-indicator';

describe('VocabularyFitIndicator', () => {
  let fixture: ComponentFixture<VocabularyFitIndicator>;
  let component: VocabularyFitIndicator;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VocabularyFitIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(VocabularyFitIndicator);
    component = fixture.componentInstance;
  });

  it('renders signal icon, percentage and "vocab fit" when percentage is provided', () => {
    fixture.componentRef.setInput('percentage', 76);
    fixture.componentRef.setInput('tone', 'mature');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.vocab-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('76% vocab fit');
    expect(indicator.querySelector('.fit-signal-icon')).toBeTruthy();
    expect(indicator.getAttribute('aria-label')).toBe('Vocabulary fit');
    expect(indicator.classList.contains('vocab-fit-indicator--mature')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-green')).toBe(true);
  });

  it('applies discovery/amber classes and limited-evidence aria-label for discovery tone', () => {
    fixture.componentRef.setInput('percentage', 13);
    fixture.componentRef.setInput('tone', 'discovery');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.vocab-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('13% vocab fit');
    expect(indicator.classList.contains('vocab-fit-indicator--discovery')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-discovery')).toBe(true);
    expect(indicator.classList.contains('reading-card-fit-amber')).toBe(true);
    expect(indicator.classList.contains('vocab-fit-indicator--mature')).toBe(false);
    expect(indicator.classList.contains('reading-card-fit-green')).toBe(false);
    expect(indicator.getAttribute('aria-label')).toBe('Vocabulary fit estimate — limited evidence');
    expect(indicator.getAttribute('title')).toBe('Vocabulary fit estimate — limited evidence');
  });

  it('applies unknown/neutral classes without amber or green for unknown tone', () => {
    fixture.componentRef.setInput('percentage', 50);
    fixture.componentRef.setInput('tone', 'unknown');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.vocab-fit-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('50% vocab fit');
    expect(indicator.classList.contains('vocab-fit-indicator--unknown')).toBe(true);
    expect(indicator.classList.contains('vocab-fit-indicator--discovery')).toBe(false);
    expect(indicator.classList.contains('vocab-fit-indicator--mature')).toBe(false);
    expect(indicator.classList.contains('reading-card-fit-amber')).toBe(false);
    expect(indicator.classList.contains('reading-card-fit-green')).toBe(false);
    expect(indicator.getAttribute('aria-label')).toBe('Vocabulary fit — evidence unavailable');
  });

  it('allows custom ariaLabel override', () => {
    fixture.componentRef.setInput('percentage', 80);
    fixture.componentRef.setInput('tone', 'mature');
    fixture.componentRef.setInput('ariaLabel', 'Custom fit description');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.vocab-fit-indicator');
    expect(indicator.getAttribute('aria-label')).toBe('Custom fit description');
  });

  it('renders nothing when percentage is null', () => {
    fixture.componentRef.setInput('percentage', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.vocab-fit-indicator')).toBeNull();
  });
});
