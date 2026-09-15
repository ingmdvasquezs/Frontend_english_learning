import { applicationReadyGuard } from './features/auth/guards/auth.guards';
import { routes } from './app.routes';

describe('application routes', () => {
  it('wraps authenticated application routes in the guarded shell', () => {
    const shell = routes.find((candidate) => candidate.path === '' && candidate.children);
    const library = shell?.children?.find((route) => route.path === 'library');

    expect(shell?.canActivate).toContain(applicationReadyGuard);
    expect(shell?.children?.some((route) => route.path === 'home')).toBe(true);
    expect(library?.children?.some((route) => route.path === 'new')).toBe(true);
    expect(shell?.children?.some((route) => route.path === 'reading/:readingId')).toBe(true);
    expect(shell?.children?.some((route) => route.path === 'documents/:documentId/read')).toBe(true);
    expect(shell?.children?.some((route) => route.path === 'profile')).toBe(true);
    expect(['login', 'register', 'onboarding'].every((path) => routes.some((route) => route.path === path))).toBe(true);
  });

  it('does not mark reader and document reader routes as immersive so the sidebar remains visible', () => {
    const shell = routes.find((candidate) => candidate.path === '' && candidate.children);
    const readingRoute = shell?.children?.find((route) => route.path === 'reading/:readingId');
    const documentRoute = shell?.children?.find((route) => route.path === 'documents/:documentId/read');

    expect(readingRoute?.data?.['immersive']).toBeUndefined();
    expect(documentRoute?.data?.['immersive']).toBeUndefined();
  });

  it('keeps login, register, and onboarding outside AppShell so they have no sidebar', () => {
    const shell = routes.find((candidate) => candidate.path === '' && candidate.children);
    const shellChildPaths = shell?.children?.map((route) => route.path) ?? [];

    expect(shellChildPaths).not.toContain('login');
    expect(shellChildPaths).not.toContain('register');
    expect(shellChildPaths).not.toContain('onboarding');
  });
});
