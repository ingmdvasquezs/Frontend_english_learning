import { HttpContext, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Auth } from '../services/auth';
import { authInterceptor, IS_PUBLIC_REQUEST } from './auth.interceptor';

describe('authInterceptor', () => {
  let mockAuth: { accessToken: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn>; url: string };

  beforeEach(() => {
    mockAuth = {
      accessToken: vi.fn(),
      logout: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
      url: '/home',
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('attaches Bearer token to protected request when token exists', () => {
    mockAuth.accessToken.mockReturnValue('test-token-123');
    const req = new HttpRequest('POST', '/ws', '<read:listUserReadingsRequest/>');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next);
    });

    expect(next).toHaveBeenCalledTimes(1);
    const interceptedReq: HttpRequest<unknown> = next.mock.calls[0][0];
    expect(interceptedReq.headers.get('Authorization')).toBe('Bearer test-token-123');
  });

  it('does not attach Bearer token to public request', () => {
    mockAuth.accessToken.mockReturnValue('test-token-123');
    const context = new HttpContext().set(IS_PUBLIC_REQUEST, true);
    const req = new HttpRequest('POST', '/ws', '<read:loginUserRequest/>', { context });
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next);
    });

    expect(next).toHaveBeenCalledTimes(1);
    const interceptedReq: HttpRequest<unknown> = next.mock.calls[0][0];
    expect(interceptedReq.headers.has('Authorization')).toBe(false);
  });

  it('attaches Bearer token to protected REST requests', () => {
    mockAuth.accessToken.mockReturnValue('rest-token-456');
    const req = new HttpRequest('GET', '/api/v1/documents');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next);
    });

    expect(next).toHaveBeenCalledTimes(1);
    const interceptedReq: HttpRequest<unknown> = next.mock.calls[0][0];
    expect(interceptedReq.headers.get('Authorization')).toBe('Bearer rest-token-456');
  });

  it('passes request without Authorization header when no token exists', () => {
    mockAuth.accessToken.mockReturnValue(null);
    const req = new HttpRequest('GET', '/api/v1/documents');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next);
    });

    expect(next).toHaveBeenCalledTimes(1);
    const interceptedReq: HttpRequest<unknown> = next.mock.calls[0][0];
    expect(interceptedReq.headers.has('Authorization')).toBe(false);
  });

  it('logs out and navigates to /login on 401 from protected request', () => {
    mockAuth.accessToken.mockReturnValue('expired-token');
    const req = new HttpRequest('POST', '/ws', '<read:getMyProfileRequest/>');
    const next = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next).subscribe({
        error: (err: HttpErrorResponse) => {
          expect(err.status).toBe(401);
        },
      });
    });

    expect(mockAuth.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not duplicate navigate if already on /login on 401', () => {
    mockAuth.accessToken.mockReturnValue('expired-token');
    mockRouter.url = '/login';
    const req = new HttpRequest('POST', '/ws', '<read:getMyProfileRequest/>');
    const next = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next).subscribe({
        error: () => undefined,
      });
    });

    expect(mockAuth.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('does not log out or redirect on 401 from public request', () => {
    const context = new HttpContext().set(IS_PUBLIC_REQUEST, true);
    const req = new HttpRequest('POST', '/ws', '<read:loginUserRequest/>', { context });
    const next = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, next).subscribe({
        error: (err: HttpErrorResponse) => {
          expect(err.status).toBe(401);
        },
      });
    });

    expect(mockAuth.logout).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('prevents duplicate navigations when concurrent 401s occur and allows future 401 redirects', async () => {
    mockAuth.accessToken.mockReturnValue('expired-token');
    mockRouter.url = '/home'; // URL remains /home throughout both concurrent 401s!

    let resolveNavigation!: (value: boolean) => void;
    const pendingNavigation = new Promise<boolean>((resolve) => {
      resolveNavigation = resolve;
    });
    mockRouter.navigate.mockReturnValue(pendingNavigation);

    const req1 = new HttpRequest('POST', '/ws', '<read:getRecommendationsRequest/>');
    const req2 = new HttpRequest('POST', '/ws', '<read:getContinueReadingRequest/>');
    const next1 = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );
    const next2 = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req1, next1).subscribe({ error: () => undefined });
      // Both requests fire while navigation is pending and mockRouter.url is still '/home'
      authInterceptor(req2, next2).subscribe({ error: () => undefined });
    });

    // Both requests trigger idempotent logout
    expect(mockAuth.logout).toHaveBeenCalledTimes(2);
    // Navigation was invoked EXACTLY ONCE
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);

    // Complete the pending navigation
    resolveNavigation(true);
    await pendingNavigation;
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate future session: user logs in, later visits /library and encounters a new 401
    mockRouter.url = '/library';
    mockRouter.navigate.mockResolvedValue(true);
    const req3 = new HttpRequest('POST', '/ws', '<read:listUserReadingsRequest/>');
    const next3 = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req3, next3).subscribe({ error: () => undefined });
    });

    // Future 401 successfully triggers a new navigation
    expect(mockRouter.navigate).toHaveBeenCalledTimes(2);
  });

  it('resets redirecting state and does not leave unhandled rejection if router.navigate rejects', async () => {
    mockAuth.accessToken.mockReturnValue('expired-token');
    mockRouter.url = '/home';
    mockRouter.navigate.mockRejectedValue(new Error('Navigation rejected'));

    const req1 = new HttpRequest('POST', '/ws', '<read:getMyProfileRequest/>');
    const next1 = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req1, next1).subscribe({ error: () => undefined });
    });

    expect(mockAuth.logout).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);

    // Allow rejection and .finally() microtask to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    // A future 401 must NOT be blocked despite the previous navigation error
    mockRouter.navigate.mockResolvedValue(true);
    const req2 = new HttpRequest('POST', '/ws', '<read:getMyProfileRequest/>');
    const next2 = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req2, next2).subscribe({ error: () => undefined });
    });

    expect(mockRouter.navigate).toHaveBeenCalledTimes(2);
  });
});
