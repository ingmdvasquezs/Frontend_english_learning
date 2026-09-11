import { HttpErrorResponse, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from '../services/auth';

export const IS_PUBLIC_REQUEST = new HttpContextToken<boolean>(() => false);

let isRedirectingToLogin = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isPublic = req.context.get(IS_PUBLIC_REQUEST);

  if (isPublic) {
    return next(req);
  }

  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.accessToken();

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: 'Bearer ' + token,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        if (!router.url.includes('/login') && !isRedirectingToLogin) {
          isRedirectingToLogin = true;
          void Promise.resolve(router.navigate(['/login']))
            .catch(() => false)
            .finally(() => {
              isRedirectingToLogin = false;
            });
        }
      }
      return throwError(() => error);
    })
  );
};
