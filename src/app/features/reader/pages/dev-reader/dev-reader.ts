import { Component, computed, inject, signal } from '@angular/core';
import { LibraryService } from '../../../library/services/library';
import { ReaderToken } from '../../models/reader.models';
import { ReaderService } from '../../services/reader';

@Component({
  selector: 'app-dev-reader',
  imports: [],
  templateUrl: './dev-reader.html',
  styleUrl: './dev-reader.css',
})
export class DevReader {
  private readonly reader = inject(ReaderService);
  private readonly libraryService = inject(LibraryService);

  readonly title = signal('My reading');
  readonly content = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tokens = signal<ReaderToken[]>([]);

  readonly canAnalyze = computed(() => {
    return this.content().trim().length > 0 && !this.loading();
  });

  onContentChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.content.set(textarea.value);
  }

  prepareReading(): void {
    if (!this.canAnalyze()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.libraryService
      .registerReading(this.title(), this.content(), 'en')
      .subscribe({
        next: (response) => {
          const parser = new DOMParser();
          const xml = parser.parseFromString(response, 'text/xml');

          const readingIdElement = xml.getElementsByTagNameNS(
            'http://soap.com/english-reading/readings',
            'readingId'
          )[0];

          const readingId = readingIdElement?.textContent;

          if (!readingId) {
            this.error.set('No se recibió el ID de la lectura');
            this.loading.set(false);
            return;
          }

          this.reader.getReaderData(readingId).subscribe({
            next: (readerResponse) => {
              const tokens = this.reader.parseReaderData(readerResponse).tokens;

              this.tokens.set(tokens);
              this.loading.set(false);
            },
            error: () => {
              this.error.set(
                'La lectura se guardó, pero no se pudo preparar'
              );
              this.loading.set(false);
            },
          });
        },

        error: () => {
          this.error.set('No se pudo registrar la lectura');
          this.loading.set(false);
        },
      });
  }
}
