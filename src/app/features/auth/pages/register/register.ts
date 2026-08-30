import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { ThemeService } from '../../../../shared/services/theme';

@Component({
  selector: 'app-register',
  imports: [],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isFormValid = computed(() => {
    return (
      this.name().trim().length > 0 &&
      this.email().includes('@') &&
      this.password().length >= 8
    );
  });

  onNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.name.set(input.value);
  }

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

    this.auth
      .register(this.name(), this.email(), this.password())
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl('/login');
        },
        error: () => {
          this.error.set('No se pudo crear la cuenta');
          this.loading.set(false);
        },
      });
  }
}
