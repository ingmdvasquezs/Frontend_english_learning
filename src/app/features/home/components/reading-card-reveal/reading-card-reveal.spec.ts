import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReadingCardReveal } from './reading-card-reveal';

describe('ReadingCardReveal', () => {
  let fixture: ComponentFixture<ReadingCardReveal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadingCardReveal],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingCardReveal);
  });

  it('renders reason, compatibility, lexical metrics and CTA', () => {
    fixture.componentRef.setInput('reason', 'Estamos conociendo tu vocabulario.');
    fixture.componentRef.setInput('compatibility', 'Fit 30%');
    fixture.componentRef.setInput('metrics', ['0 Known words', '0 Learning words', '252 Words to learn']);
    fixture.componentRef.setInput('cta', 'Open reading →');
    fixture.componentRef.setInput('tone', 'discovery');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.reading-card-reason-reveal')?.textContent).toContain('Estamos conociendo tu vocabulario');
    expect(root.querySelector('.reading-card-primary-metric')?.textContent).toContain('Fit 30%');
    expect(root.querySelector('.reading-card-reveal-details')?.textContent).toContain('252 Words to learn');
    expect(root.querySelector('.reading-card-reveal-cta')?.textContent).toContain('Open reading →');

    const primaryMetric = root.querySelector('.reading-card-primary-metric');
    expect(primaryMetric?.classList.contains('reading-card-fit-discovery')).toBe(true);
  });

  it('omits reason paragraph when reason is null without rendering empty tag', () => {
    fixture.componentRef.setInput('compatibility', 'Fit 45%');
    fixture.componentRef.setInput('metrics', ['10 Known words']);
    fixture.componentRef.setInput('cta', 'Continue reading →');
    fixture.componentRef.setInput('tone', 'mature');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.reading-card-reason-reveal')).toBeNull();
    expect(root.querySelector('.reading-card-primary-metric')?.textContent).toContain('Fit 45%');
    expect(root.querySelector('.reading-card-primary-metric')?.classList.contains('reading-card-fit-normal')).toBe(true);
  });
});
