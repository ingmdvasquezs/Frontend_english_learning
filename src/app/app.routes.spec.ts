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

  it('exposes collections/:slug route and redirects explore/collections to canonical collections', () => {
    const shell = routes.find((candidate) => candidate.path === '' && candidate.children);
    const collectionsRoute = shell?.children?.find((route) => route.path === 'collections/:slug');
    const legacyCollectionRedirect = shell?.children?.find(
      (route) => route.path === 'explore/collections/:collectionKey'
    );
    const exploreRoute = shell?.children?.find((route) => route.path === 'explore');

    expect(collectionsRoute).toBeDefined();
    expect(legacyCollectionRedirect).toBeDefined();
    expect(exploreRoute).toBeDefined();

    // Verify ordering: legacy redirect comes before general explore route
    const legacyIndex = shell?.children?.indexOf(legacyCollectionRedirect!);
    const exploreIndex = shell?.children?.indexOf(exploreRoute!);
    expect(legacyIndex).toBeLessThan(exploreIndex!);

    if (typeof legacyCollectionRedirect?.redirectTo === 'function') {
      const redirectFn = legacyCollectionRedirect.redirectTo as (data: any) => string;
      expect(redirectFn({ params: { collectionKey: 'classics' } })).toBe('/collections/classics');
    }

    // FASE 15.3: Verify explore redirects to /home and has NO child component
    expect(exploreRoute?.redirectTo).toBe('/home');
    expect(exploreRoute?.pathMatch).toBe('full');
    expect(exploreRoute?.children).toBeUndefined();
    expect(exploreRoute?.loadComponent).toBeUndefined();
  });

  describe('FASE 15.3 route invariants (A through F)', () => {
    const shell = routes.find((candidate) => candidate.path === '' && candidate.children)!;

    it('A. /explore redirects to /home (EXPLORE_ROOT_FINAL_DESTINATION = /home)', () => {
      const exploreRoute = shell.children?.find((route) => route.path === 'explore');
      expect(exploreRoute).toBeDefined();
      expect(exploreRoute?.redirectTo).toBe('/home');
      expect(exploreRoute?.pathMatch).toBe('full');
    });

    it('B. /explore/collections/colombian-myths-legends redirects to /collections/colombian-myths-legends', () => {
      const legacyRedirect = shell.children?.find(
        (route) => route.path === 'explore/collections/:collectionKey'
      );
      expect(legacyRedirect).toBeDefined();
      expect(typeof legacyRedirect?.redirectTo).toBe('function');
      const redirectFn = legacyRedirect!.redirectTo as (data: any) => string;
      expect(redirectFn({ params: { collectionKey: 'colombian-myths-legends' } })).toBe(
        '/collections/colombian-myths-legends'
      );
    });

    it('C. /collections/colombian-myths-legends matches collections/:slug and loads CollectionDetail', async () => {
      const collectionsRoute = shell.children?.find((route) => route.path === 'collections/:slug');
      expect(collectionsRoute).toBeDefined();
      expect(collectionsRoute?.loadComponent).toBeDefined();
      const comp = await collectionsRoute!.loadComponent!();
      expect(comp).toBeDefined();
    });

    it('D & E. collections/:slug serves latin-america and new without separate deprecated routes', () => {
      const collectionsRoute = shell.children?.find((route) => route.path === 'collections/:slug');
      expect(collectionsRoute).toBeDefined();
      // Verifies that neither latin-america nor new need duplicate shell routes
      const latamDirect = shell.children?.find((route) => route.path === 'collections/latin-america');
      const newDirect = shell.children?.find((route) => route.path === 'collections/new');
      expect(latamDirect).toBeUndefined();
      expect(newDirect).toBeUndefined();
    });

    it('F. root route / redirects to /home without loops', () => {
      const rootRedirect = shell.children?.find((route) => route.path === '');
      expect(rootRedirect).toBeDefined();
      expect(rootRedirect?.redirectTo).toBe('home');
      expect(rootRedirect?.pathMatch).toBe('full');
    });

    it('confirms zero routes load any decommissioned Explore component', () => {
      const checkRoutes = (routeList: any[]) => {
        for (const route of routeList) {
          expect(route.component?.name).not.toBe('Explore');
          if (route.children) {
            checkRoutes(route.children);
          }
        }
      };
      checkRoutes(routes);
    });
  });
});
