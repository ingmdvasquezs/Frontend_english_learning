import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorialHero } from './editorial-hero';
import { EditorialHeroSlide } from '../../models/editorial-hero.models';

describe('EditorialHero', () => {
  let fixture: ComponentFixture<EditorialHero>;
  let component: EditorialHero;

  const mockSlides: EditorialHeroSlide[] = [
    {
      id: 'slide-1',
      eyebrow: 'Hola 👋',
      title: 'Aprende inglés con historias que realmente quieras leer.',
      description: 'Historias reales. Nuevo vocabulario. Un mundo más grande.',
      ctaLabel: 'Encontrar una historia',
      ctaTarget: '#recommendations-heading',
      location: 'Villa de Leyva, Colombia',
      quote: 'Different stories. A more open you.',
    },
    {
      id: 'slide-2',
      eyebrow: 'Campaña 2',
      title: 'Segunda campaña editorial.',
      description: 'Otra descripción.',
      ctaLabel: 'Explorar ahora',
      ctaTarget: '#colombia-heading',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorialHero],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorialHero);
    component = fixture.componentInstance;
  });

  it('renders active slide details correctly', () => {
    fixture.componentRef.setInput('slides', mockSlides);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hola 👋');
    expect(text).toContain('Aprende inglés con historias que realmente quieras leer.');
    expect(text).toContain('Encontrar una historia');
    expect(text).toContain('Villa de Leyva, Colombia');
    expect(text).toContain('Different stories. A more open you.');
  });

  it('navigates through slides with controls', () => {
    fixture.componentRef.setInput('slides', mockSlides);
    fixture.detectChanges();

    expect(component.activeIndex()).toBe(0);
    component.nextSlide();
    expect(component.activeIndex()).toBe(1);
    component.nextSlide();
    expect(component.activeIndex()).toBe(0);
    component.previousSlide();
    expect(component.activeIndex()).toBe(1);
  });

  it('emits ctaClick when clicking the main CTA button', () => {
    fixture.componentRef.setInput('slides', mockSlides);
    fixture.detectChanges();

    let emitted: EditorialHeroSlide | null = null;
    component.ctaClick.subscribe((slide) => (emitted = slide));

    const ctaButton = fixture.nativeElement.querySelector('.hero-primary-cta') as HTMLButtonElement;
    ctaButton.click();

    expect(emitted).toEqual(mockSlides[0]);
  });

  it('keeps core copy fixed when navigating between slides', () => {
    fixture.componentRef.setInput('slides', mockSlides);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Aprende inglés con historias que realmente quieras leer.');
    expect(root.textContent).toContain('Different stories. A more open you.');
    expect(root.textContent).toContain('Villa de Leyva, Colombia');

    component.nextSlide();
    fixture.detectChanges();

    // Core copy remains fixed from primary slide
    expect(root.textContent).toContain('Aprende inglés con historias que realmente quieras leer.');
    expect(root.textContent).toContain('Different stories. A more open you.');
  });

  it('pauses rotation on mouse enter and resumes on mouse leave', () => {
    fixture.componentRef.setInput('slides', mockSlides);
    fixture.detectChanges();

    expect(component.isPaused()).toBe(false);
    component.onMouseEnter();
    expect(component.isPaused()).toBe(true);
    component.onMouseLeave();
    expect(component.isPaused()).toBe(false);
  });

  it('renders discrete accessible dots for slides', () => {
    const canonicalSlides: EditorialHeroSlide[] = [
      {
        id: 'london',
        eyebrow: 'Hola 👋',
        title: 'Title',
        description: 'Desc',
        ctaLabel: 'CTA',
        ctaTarget: '#rec',
        location: 'London, United Kingdom',
        imageUrl: '/assets/editorial/heroes/home/hero-home-london-westminster.webp',
        dotLabel: 'Show London',
      },
      {
        id: 'new-york',
        eyebrow: 'Hola 👋',
        title: 'Title',
        description: 'Desc',
        ctaLabel: 'CTA',
        ctaTarget: '#rec',
        location: 'Brooklyn, New York, USA',
        imageUrl: '/assets/editorial/heroes/home/hero-home-new-york-brooklyn.webp',
        dotLabel: 'Show New York',
      },
    ];

    fixture.componentRef.setInput('slides', canonicalSlides);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const dots = root.querySelectorAll('.hero-dot');
    expect(dots.length).toBe(2);
    expect(dots[0].getAttribute('aria-label')).toBe('Show London');
    expect(dots[1].getAttribute('aria-label')).toBe('Show New York');
    expect(dots[0].classList.contains('hero-dot-active')).toBe(true);

    // Click second dot
    (dots[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(1);
    expect(root.textContent).toContain('Brooklyn, New York, USA');
  });
});
