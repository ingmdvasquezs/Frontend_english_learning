import { Component, computed, input, signal } from '@angular/core';
import { coverUrl } from '../../../features/home/utils/cover-url';
import { userTextCoverUrl } from '../../utils/user-text-cover';

@Component({
  selector: 'app-reading-cover',
  templateUrl: './reading-cover.html',
  styleUrl: './reading-cover.css',
})
export class ReadingCover {
  readonly coverKey = input<string | null | undefined>(null);
  readonly title = input<string | null | undefined>('');
  readonly origin = input<string | null | undefined>('PLATFORM');
  readonly readingId = input<string | null | undefined>(null);
  readonly altText = input<string | null | undefined>(null);

  readonly imageFailed = signal(false);

  readonly imageUrl = computed<string | null>(() => {
    if (this.imageFailed()) {
      return null;
    }
    if (this.origin() === 'USER' && this.readingId()) {
      return userTextCoverUrl(this.readingId()!);
    }
    return coverUrl(this.coverKey());
  });

  readonly resolvedAlt = computed<string>(() => {
    const explicit = this.altText();
    if (explicit) return explicit;
    const t = this.title()?.trim();
    return t ? `Portada de ${t}` : 'Portada de lectura';
  });

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
