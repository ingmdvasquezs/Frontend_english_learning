import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); TestBed.resetTestingModule(); });

  it('defaults to light independently of the OS and applies the global attribute', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const service = TestBed.configureTestingModule({}).inject(ThemeService);
    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('toggles, persists and restores both themes', () => {
    let service = TestBed.configureTestingModule({}).inject(ThemeService);
    service.toggleTheme();
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    TestBed.resetTestingModule();
    service = TestBed.configureTestingModule({}).inject(ThemeService);
    expect(service.theme()).toBe('dark');
    service.toggleTheme();
    expect(localStorage.getItem('english-reading-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
