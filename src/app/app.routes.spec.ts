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
    expect(['login', 'register', 'onboarding'].every((path) => routes.some((route) => route.path === path))).toBe(true);
  });
});
