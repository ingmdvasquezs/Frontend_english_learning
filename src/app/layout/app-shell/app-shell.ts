import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../features/auth/services/auth';
import { ThemeService } from '../../shared/services/theme';
import { ProfileService } from '../../features/profile/services/profile';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly profileService = inject(ProfileService);
  readonly drawerOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly profileLabel = computed(() => this.profileService.profile()?.alias || this.profileService.profile()?.name || 'Usuario');
  readonly profileInitials = computed(() => {
    const words = (this.profileService.profile()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    return words.length ? `${words[0][0]}${words.length > 1 ? words.at(-1)![0] : ''}`.toUpperCase() : 'U';
  });

  ngOnInit(): void { this.profileService.loadProfile(); }

  closeDrawer(): void { this.drawerOpen.set(false); }

  logout(): void {
    this.profileService.clearProfile();
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
