import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { EditorialHeroSlide } from '../../models/editorial-hero.models';

@Component({
  selector: 'app-editorial-hero',
  templateUrl: './editorial-hero.html',
  styleUrl: './editorial-hero.css',
})
export class EditorialHero implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly slides = input.required<EditorialHeroSlide[]>();
  readonly activeIndex = signal(0);
  readonly isPaused = signal(false);
  readonly ctaClick = output<EditorialHeroSlide>();

  // Slide 0 loads immediately; remaining slides preload after initial render
  readonly loadedIndices = signal<ReadonlySet<number>>(new Set([0]));

  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  // Fixed core copy taken from primary slide
  readonly primarySlide = computed<EditorialHeroSlide | null>(() => {
    const list = this.slides();
    return list.length > 0 ? list[0] : null;
  });

  currentSlide(): EditorialHeroSlide | null {
    const list = this.slides();
    if (!list.length) return null;
    const index = Math.max(0, Math.min(this.activeIndex(), list.length - 1));
    return list[index];
  }

  readonly activeLocation = computed<string | null>(() => {
    const list = this.slides();
    if (!list.length) return null;
    const index = Math.max(0, Math.min(this.activeIndex(), list.length - 1));
    return list[index]?.location ?? null;
  });

  ngOnInit(): void {
    this.initHeroRotation();
  }

  onMouseEnter(): void {
    this.isPaused.set(true);
  }

  onMouseLeave(): void {
    this.isPaused.set(false);
  }

  nextSlide(): void {
    const list = this.slides();
    if (list.length <= 1) return;
    this.activeIndex.update((i) => (i + 1) % list.length);
    this.ensureSlideLoaded(this.activeIndex());
  }

  previousSlide(): void {
    const list = this.slides();
    if (list.length <= 1) return;
    this.activeIndex.update((i) => (i - 1 + list.length) % list.length);
    this.ensureSlideLoaded(this.activeIndex());
  }

  goToSlide(index: number): void {
    const list = this.slides();
    if (index >= 0 && index < list.length) {
      this.activeIndex.set(index);
      this.ensureSlideLoaded(index);
    }
  }

  onCtaClick(slide?: EditorialHeroSlide | null): void {
    const target = slide ?? this.primarySlide() ?? this.currentSlide();
    if (target) {
      this.ctaClick.emit(target);
    }
  }

  getDotLabel(slide: EditorialHeroSlide, index: number): string {
    if (slide.dotLabel) return slide.dotLabel;
    if (slide.location) {
      const city = slide.location.split(',')[0].trim();
      return `Show ${city}`;
    }
    return `Show slide ${index + 1}`;
  }

  private ensureSlideLoaded(index: number): void {
    if (!this.loadedIndices().has(index)) {
      this.loadedIndices.update((set) => new Set([...set, index]));
    }
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private initHeroRotation(): void {
    if (typeof window === 'undefined') return;
    if (this.prefersReducedMotion()) return;
    if (this.slides().length <= 1) return;

    this.preloadSecondaryImages();

    this.rotationTimer = setInterval(() => {
      if (!this.isPaused() && this.slides().length > 1) {
        this.nextSlide();
      }
    }, 7000);

    this.destroyRef.onDestroy(() => {
      if (this.rotationTimer !== null) {
        clearInterval(this.rotationTimer);
        this.rotationTimer = null;
      }
    });
  }

  private preloadSecondaryImages(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      const list = this.slides();
      if (typeof Image !== 'undefined') {
        for (let i = 1; i < list.length; i++) {
          if (list[i].imageUrl) {
            const img = new Image();
            img.src = list[i].imageUrl!;
          }
        }
      }
      const allIndices = list.map((_, i) => i);
      this.loadedIndices.set(new Set(allIndices));
    }, 1000);
  }
}
