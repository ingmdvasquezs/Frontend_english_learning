import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../features/auth/services/auth';
import { ThemeService } from '../../shared/services/theme';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly drawerOpen = signal(false);
  readonly userMenuOpen = signal(false);

  closeDrawer(): void { this.drawerOpen.set(false); }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
