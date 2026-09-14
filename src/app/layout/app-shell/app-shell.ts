import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly themeService = inject(ThemeService);
  readonly profileService = inject(ProfileService);
  readonly drawerOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly isImmersive = signal(false);
  readonly profileLabel = computed(() => this.profileService.profile()?.alias || this.profileService.profile()?.name || 'Usuario');
  readonly profileInitials = computed(() => {
    const words = (this.profileService.profile()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    return words.length ? `${words[0][0]}${words.length > 1 ? words.at(-1)![0] : ''}`.toUpperCase() : 'U';
  });

  ngOnInit(): void {
    this.profileService.loadProfile();
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      let current: ActivatedRoute = this.route;
      while (current.firstChild) current = current.firstChild;
      this.isImmersive.set(current.snapshot.data['immersive'] === true);
    });
  }

  closeDrawer(): void { this.drawerOpen.set(false); }

  navigateToExplore(): void {
    this.closeDrawer();
    if (this.router.url.startsWith('/home')) {
      const el = typeof document !== 'undefined' ? document.getElementById('explore-stories-heading') : null;
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    void this.router.navigate(['/home'], { fragment: 'explore-stories-heading' });
  }

  logout(): void {
    this.profileService.clearProfile();
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
