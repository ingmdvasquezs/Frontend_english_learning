import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../services/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.removeItem('english-reading-theme');
    auth = { login: vi.fn() };
    router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
  });

  it('uses light by default and exposes a persistent theme control', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Cambiar a modo oscuro"]') as HTMLButtonElement;
    expect(document.documentElement.dataset['theme']).toBe('light');
    button.click();
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
  });

  it.each([
    [false, '/onboarding'],
    [true, '/home'],
  ])(
    'routes after login when onboardingCompleted is %s',
    (onboardingCompleted, expectedPath) => {
      auth.login.mockReturnValue(
        of({ accessToken: 'token', onboardingCompleted })
      );
      component.email.set('user@example.com');
      component.password.set('password');

      component.onSubmit(new Event('submit'));

      expect(router.navigateByUrl).toHaveBeenCalledWith(expectedPath);
    }
  );
});
