import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
});
