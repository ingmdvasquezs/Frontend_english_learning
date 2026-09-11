import { Routes } from '@angular/router';
import {
  applicationReadyGuard,
  onboardingPendingGuard,
} from './features/auth/guards/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [applicationReadyGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/pages/home/home').then((m) => m.Home),
      },
      {
        path: 'library',
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./features/library/pages/library/library').then((m) => m.Library) },
          { path: 'new', loadComponent: () => import('./features/library/pages/new-reading/new-reading').then((m) => m.NewReading) },
        ],
      },
      {
        path: 'vocabulary',
        loadComponent: () =>
          import('./features/vocabulary/pages/vocabulary/vocabulary').then(
            (m) => m.Vocabulary
          ),
      },
      {
        path: 'reading/:readingId',
        loadComponent: () =>
          import('./features/reader/pages/reader/reader').then((m) => m.Reader),
      },
      {
        path: 'documents/:documentId/read',
        loadComponent: () =>
          import('./features/documents/pages/document-reader/document-reader').then((m) => m.DocumentReader),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [onboardingPendingGuard],
    loadComponent: () =>
      import('./features/onboarding/pages/onboarding/onboarding').then(
        (m) => m.Onboarding
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  {
    path: '**',
    redirectTo: 'login',
  },

];
