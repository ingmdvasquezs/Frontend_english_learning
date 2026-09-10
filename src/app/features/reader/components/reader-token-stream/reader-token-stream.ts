import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, effect, inject, input, output, viewChildren } from '@angular/core';
import { ReaderToken } from '../../models/reader.models';

export interface ReaderWordSelection {
  token: ReaderToken;
  event: MouseEvent;
}

@Component({
  selector: 'app-reader-token-stream',
  templateUrl: './reader-token-stream.html',
  styleUrl: './reader-token-stream.css',
})
export class ReaderTokenStream {
  readonly tokens = input.required<readonly ReaderToken[]>();
  readonly activeNarrationTokenIndex = input<number | null>(null);
  readonly wordSelected = output<ReaderWordSelection>();
  private readonly browserDocument = inject(DOCUMENT);
  private readonly wordElements = viewChildren<ElementRef<HTMLButtonElement>>('wordToken');
  private manualFollowSuppressed = false;

  constructor() {
    effect(() => {
      const activeIndex = this.activeNarrationTokenIndex();
      const words = this.wordElements();
      if (activeIndex === null) {
        this.manualFollowSuppressed = false;
        return;
      }
      const activeWord = words.find((word) => Number(word.nativeElement.dataset['tokenIndex']) === activeIndex);
      if (activeWord) this.followActiveWord(activeWord.nativeElement);
    });
  }

  select(token: ReaderToken, event: MouseEvent): void {
    this.wordSelected.emit({ token, event });
  }

  @HostListener('window:wheel')
  @HostListener('window:touchmove')
  suspendAutoFollow(): void {
    if (this.activeNarrationTokenIndex() !== null) this.manualFollowSuppressed = true;
  }

  @HostListener('window:keydown', ['$event'])
  suspendAutoFollowForKeyboard(event: KeyboardEvent): void {
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) this.suspendAutoFollow();
  }

  private followActiveWord(element: HTMLButtonElement): void {
    const viewportHeight = this.browserDocument.defaultView?.innerHeight;
    if (!viewportHeight) return;
    const rect = element.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
    const insideSafeZone = rect.top >= viewportHeight * .2 && rect.bottom <= viewportHeight * .8;
    if (insideSafeZone || (this.manualFollowSuppressed && fullyVisible)) return;
    element.scrollIntoView?.({ behavior:'smooth',block:'center',inline:'nearest' });
    this.manualFollowSuppressed = false;
  }
}
