import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from '../../features/auth/services/auth';
import { ThemeService } from '../../shared/services/theme';
import { AppShell } from './app-shell';

@Component({ template: '' })
class EmptyPage {}

describe('AppShell', () => {
  it('renders real navigation, theme label and delegates logout to Auth', async () => {
    const auth = { logout: vi.fn() };
    await TestBed.configureTestingModule({ imports:[AppShell], providers:[provideRouter([{path:'login', component:EmptyPage}]), {provide:Auth,useValue:auth}] }).compileComponents();
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a[href="/home"]')).toBeTruthy();
    expect(root.querySelector('a[href="/library"]')).toBeTruthy();
    expect(root.querySelector('a[href="/library/new"]')).toBeTruthy();
    expect(root.querySelector('button[aria-label="Cambiar a modo oscuro"]')).toBeTruthy();
    (root.querySelector('button[aria-label="Abrir menú de usuario"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.includes('Cerrar sesión')) as HTMLButtonElement).click();
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
