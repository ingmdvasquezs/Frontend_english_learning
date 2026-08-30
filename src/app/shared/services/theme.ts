import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'english-reading-theme';
  readonly theme = signal<AppTheme>(this.readStoredTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    localStorage.setItem(this.storageKey, theme);
    this.apply(theme);
  }

  private readStoredTheme(): AppTheme {
    const stored = localStorage.getItem(this.storageKey);
    return stored === 'dark' ? 'dark' : 'light';
  }

  private apply(theme: AppTheme): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = theme;
    root.classList.toggle('dark', theme === 'dark');
  }
}
