import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Auth } from '../services/auth';
import { applicationReadyGuard, onboardingPendingGuard } from './auth.guards';

describe('auth onboarding guards', () => {
  const accessToken = signal<string | null>('token');
  const onboardingCompleted = signal<boolean | null>(false);
  let router: Router;

  beforeEach(() => {
    accessToken.set('token');
    onboardingCompleted.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { accessToken, onboardingCompleted },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('allows onboarding only while it is pending', () => {
    const pendingResult = TestBed.runInInjectionContext(() =>
      onboardingPendingGuard({} as never, {} as never)
    );
    expect(pendingResult).toBe(true);

    onboardingCompleted.set(true);
    const completedResult = TestBed.runInInjectionContext(() =>
      onboardingPendingGuard({} as never, {} as never)
    ) as UrlTree;
    expect(router.serializeUrl(completedResult)).toBe('/home');
  });

  it('sends users with pending onboarding away from the application', () => {
    const result = TestBed.runInInjectionContext(() =>
      applicationReadyGuard({} as never, {} as never)
    ) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/onboarding');
  });

  it('requires a new backend-authenticated login if session data is incomplete', () => {
    onboardingCompleted.set(null);
    const result = TestBed.runInInjectionContext(() =>
      applicationReadyGuard({} as never, {} as never)
    ) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/login');
  });
});
