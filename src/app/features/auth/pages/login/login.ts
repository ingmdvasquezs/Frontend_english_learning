import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NORMAL_APPLICATION_PATH } from '../../../../app.paths';
import { Auth } from '../../services/auth';
import { ThemeService } from '../../../../shared/services/theme';

@Component({
  imports: [],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isFormValid = computed(() => {
    return (
      this.email().includes('@') &&
      this.password().length >= 8
    );
  });

  onEmailChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.email.set(input.value);
  }

  onPasswordChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.password.set(input.value);
  }
  onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.isFormValid() || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.email(), this.password()).subscribe({
      next: ({ onboardingCompleted }) => {
        this.loading.set(false);
        void this.router.navigateByUrl(
          onboardingCompleted ? NORMAL_APPLICATION_PATH : '/onboarding'
        );
      },
      error: () => {
        this.error.set('No se pudo iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
