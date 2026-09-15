import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { Auth } from '../../features/auth/services/auth';
import { ThemeService } from '../../shared/services/theme';
import { AppShell } from './app-shell';
import { ProfileService } from '../../features/profile/services/profile';

@Component({ template: '' })
class EmptyPage {}

describe('AppShell', () => {
  it('renders real navigation, theme label and delegates logout to Auth', async () => {
    const auth = { logout: vi.fn() };
    const profile = { profile: signal({ name:'Ada Lovelace', alias:'AdaPublic', age:null, nativeLanguage:null, learningLanguage:'en', email:'ada@example.com' }), loadProfile:vi.fn(), clearProfile:vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([{path:'login', component:EmptyPage},{path:'profile',component:EmptyPage}]), {provide:Auth,useValue:auth}, {provide:ProfileService,useValue:profile}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a[href="/home"]')).toBeTruthy();
    expect(root.querySelector('a[href="/library"]')).toBeTruthy();
    expect(root.querySelector('a[href="/vocabulary"]')).toBeTruthy();
    expect(root.querySelector('a[href="/library/new"]')).toBeFalsy();
    expect(root.textContent).not.toContain('Nueva lectura');
    expect(root.textContent).toContain('AdaPublic');
    expect(root.querySelector('button[aria-label="Cambiar a modo oscuro"]')).toBeTruthy();
    (root.querySelector('button[aria-label="Abrir menú de usuario"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('a[href="/profile"]')).toBeTruthy();
    (Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(profile.clearProfile).toHaveBeenCalledOnce();
  });

  it('falls back to name and reacts immediately to profile changes', async () => {
    const profileSignal = signal<any>({ name:'Ada', alias:null, age:null, nativeLanguage:null, learningLanguage:'en', email:'a@b.com' });
    const profile = { profile:profileSignal, loadProfile:vi.fn(), clearProfile:vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([]),{provide:Auth,useValue:{logout:vi.fn()}},{provide:ProfileService,useValue:profile}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada');
    profileSignal.set({ ...profileSignal(), alias:'AdaNew' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('AdaNew');
  });

  it('displays the ERP branding and editorial tagline in the sidebar', async () => {
    const profile = { profile: signal({ name:'Test', alias:null, age:null, nativeLanguage:null, learningLanguage:'en', email:'t@t.com' }), loadProfile:vi.fn(), clearProfile:vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([]),{provide:Auth,useValue:{logout:vi.fn()}},{provide:ProfileService,useValue:profile}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.brand-name')?.textContent?.trim()).toBe('ERP');
    expect(root.querySelector('.brand-tagline')).toBeTruthy();
  });

  it('renders the Explorar navigation link', async () => {
    const profile = { profile: signal({ name:'Test', alias:null, age:null, nativeLanguage:null, learningLanguage:'en', email:'t@t.com' }), loadProfile:vi.fn(), clearProfile:vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([{path:'home',component:EmptyPage}]),{provide:Auth,useValue:{logout:vi.fn()}},{provide:ProfileService,useValue:profile}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const exploreLink = root.querySelector('.nav-explore-link');
    expect(exploreLink).toBeTruthy();
    expect(exploreLink?.textContent).toContain('Explorar');
  });

  it('starts in non-immersive mode by default', async () => {
    const profile = { profile: signal({ name:'Test', alias:null, age:null, nativeLanguage:null, learningLanguage:'en', email:'t@t.com' }), loadProfile:vi.fn(), clearProfile:vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([]),{provide:Auth,useValue:{logout:vi.fn()}},{provide:ProfileService,useValue:profile}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell); fixture.detectChanges();
    expect(fixture.componentInstance.isImmersive()).toBe(false);
    expect(fixture.nativeElement.querySelector('.shell-immersive')).toBeFalsy();
  });

  describe('Reader Sidebar Consistency', () => {
    let router: Router;
    let authMock: { logout: any };
    let profileMock: { profile: any; loadProfile: any; clearProfile: any };

    const routes: Routes = [
      {
        path: '',
        component: AppShell,
        children: [
          { path: 'home', component: EmptyPage },
          { path: 'reading/:readingId', component: EmptyPage },
          { path: 'documents/:documentId/read', component: EmptyPage },
          { path: 'library', component: EmptyPage },
          { path: 'vocabulary', component: EmptyPage },
        ],
      },
      { path: 'login', component: EmptyPage },
      { path: 'register', component: EmptyPage },
      { path: 'onboarding', component: EmptyPage },
    ];

    beforeEach(() => {
      authMock = { logout: vi.fn() };
      profileMock = {
        profile: signal({ name: 'Ada Lovelace', alias: 'Ada', age: null, nativeLanguage: null, learningLanguage: 'en', email: 'ada@example.com' }),
        loadProfile: vi.fn(),
        clearProfile: vi.fn(),
      };
    });

    it('A. keeps sidebar visible on /home', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/home');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.sidebar')).toBeTruthy();
      expect(root.querySelector('.shell-immersive')).toBeFalsy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('B. keeps sidebar visible when navigating from Home to PLATFORM Reader', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/home');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      await router.navigateByUrl('/reading/platform-reading-1');
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.sidebar')).toBeTruthy();
      expect(root.querySelector('.shell-immersive')).toBeFalsy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('C. keeps sidebar visible on direct load / hard refresh on /reading/:id', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/reading/direct-load-reading-42');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.sidebar')).toBeTruthy();
      expect(root.querySelector('.shell-immersive')).toBeFalsy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('D. produces the exact same shell layout state on navigation vs refresh for Reader', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      // Direct load (refresh) state
      await router.navigateByUrl('/reading/consistent-reading-100');
      const directFixture = TestBed.createComponent(AppShell);
      directFixture.detectChanges();

      const directIsImmersive = directFixture.componentInstance.isImmersive();
      const directHasSidebar = directFixture.nativeElement.querySelector('.sidebar') !== null;
      const directHasImmersiveClass = directFixture.nativeElement.querySelector('.shell-immersive') !== null;

      // Client navigation state
      await router.navigateByUrl('/home');
      directFixture.detectChanges();
      await router.navigateByUrl('/reading/consistent-reading-100');
      directFixture.detectChanges();

      const navIsImmersive = directFixture.componentInstance.isImmersive();
      const navHasSidebar = directFixture.nativeElement.querySelector('.sidebar') !== null;
      const navHasImmersiveClass = directFixture.nativeElement.querySelector('.shell-immersive') !== null;

      expect(navIsImmersive).toBe(directIsImmersive);
      expect(navHasSidebar).toBe(directHasSidebar);
      expect(navHasImmersiveClass).toBe(directHasImmersiveClass);
      expect(navIsImmersive).toBe(false);
      expect(navHasSidebar).toBe(true);
      expect(navHasImmersiveClass).toBe(false);
    });

    it('E. keeps sidebar visible when navigating from Collection to Reader', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/home');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      await router.navigateByUrl('/reading/col-nature-01');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('F. keeps sidebar visible when navigating from Continue Reading to Reader', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/home');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      await router.navigateByUrl('/reading/in-progress-story-5');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('G. prevents stale shell state across Reader -> Library -> Reader transitions', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/reading/reading-part-1');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();

      await router.navigateByUrl('/library');
      fixture.detectChanges();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();

      await router.navigateByUrl('/reading/reading-part-2');
      fixture.detectChanges();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();
    });

    it('H. keeps sidebar visible on DocumentReader for EPUB/PDF', async () => {
      await TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter(routes),
          { provide: Auth, useValue: authMock },
          { provide: ProfileService, useValue: profileMock },
        ],
      }).compileComponents();

      router = TestBed.inject(Router);
      await router.navigateByUrl('/home');
      const fixture = TestBed.createComponent(AppShell);
      fixture.detectChanges();

      await router.navigateByUrl('/documents/epub-document-99/read');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.sidebar')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.shell-immersive')).toBeFalsy();
      expect(fixture.componentInstance.isImmersive()).toBe(false);
    });

    it('I. verifies Onboarding and Auth routes remain independent without AppShell sidebar', () => {
      const shellChildPaths = routes.find((r) => r.path === '')?.children?.map((c) => c.path) ?? [];
      expect(shellChildPaths).not.toContain('login');
      expect(shellChildPaths).not.toContain('register');
      expect(shellChildPaths).not.toContain('onboarding');

      const topLevelPaths = routes.map((r) => r.path);
      expect(topLevelPaths).toContain('login');
      expect(topLevelPaths).toContain('register');
      expect(topLevelPaths).toContain('onboarding');
    });
  });
});
