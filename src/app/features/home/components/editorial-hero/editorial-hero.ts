import { Component, input, output, signal } from '@angular/core';
import { EditorialHeroSlide } from '../../models/editorial-hero.models';

@Component({
  selector: 'app-editorial-hero',
  templateUrl: './editorial-hero.html',
  styleUrl: './editorial-hero.css',
})
export class EditorialHero {
  readonly slides = input.required<EditorialHeroSlide[]>();
  readonly activeIndex = signal(0);
  readonly ctaClick = output<EditorialHeroSlide>();

  currentSlide() {
    const list = this.slides();
    if (!list.length) return null;
    const index = Math.max(0, Math.min(this.activeIndex(), list.length - 1));
    return list[index];
  }

  nextSlide(): void {
    const list = this.slides();
    if (list.length <= 1) return;
    this.activeIndex.update((i) => (i + 1) % list.length);
  }

  previousSlide(): void {
    const list = this.slides();
    if (list.length <= 1) return;
    this.activeIndex.update((i) => (i - 1 + list.length) % list.length);
  }

  goToSlide(index: number): void {
    const list = this.slides();
    if (index >= 0 && index < list.length) {
      this.activeIndex.set(index);
    }
  }

  onCtaClick(slide: EditorialHeroSlide): void {
    this.ctaClick.emit(slide);
  }
}
