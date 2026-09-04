import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LibraryService } from '../../services/library';

@Component({
  selector: 'app-new-reading',
  imports: [RouterLink],
  templateUrl: './new-reading.html',
  styleUrl: './new-reading.css',
})
export class NewReading {
  readonly maxTitleLength = 200;
  readonly maxContentLength = 1_048_576;

  private readonly libraryService = inject(LibraryService);
  private readonly router = inject(Router);

  readonly title = signal('');
  readonly content = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canSubmit = computed(
    () =>
      this.title().trim().length > 0 &&
      this.title().length <= this.maxTitleLength &&
      this.content().trim().length > 0 &&
      this.content().length <= this.maxContentLength &&
      !this.loading()
  );

  onTitleChange(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onContentChange(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  createReading(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.libraryService
      .registerReading(this.title().trim(), this.content().trim(), 'en')
      .subscribe({
        next: (response) => {
          this.libraryService.parseRegisteredReadingResponse(response);

          void this.router.navigateByUrl('/library');
        },
        error: () => {
          this.error.set('No se pudo registrar la lectura');
          this.loading.set(false);
        },
      });
  }
}
