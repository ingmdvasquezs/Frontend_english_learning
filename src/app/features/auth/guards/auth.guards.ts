import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NORMAL_APPLICATION_PATH } from '../../../app.paths';
import { Auth } from '../services/auth';

export const onboardingPendingGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.accessToken() || auth.onboardingCompleted() === null) {
    return router.createUrlTree(['/login']);
  }

  return auth.onboardingCompleted() === false
    ? true
    : router.createUrlTree([NORMAL_APPLICATION_PATH]);
};

export const applicationReadyGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.accessToken() || auth.onboardingCompleted() === null) {
    return router.createUrlTree(['/login']);
  }

  return auth.onboardingCompleted()
    ? true
    : router.createUrlTree(['/onboarding']);
};
