import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../services/auth';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let auth: { register: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.removeItem('english-reading-theme');
    auth = { register: vi.fn(() => of('<response/>')) };
    router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
  });

  it('renders light by default and can select dark', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[aria-label="Cambiar a modo oscuro"]') as HTMLButtonElement).click();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
  });

  it('redirects to login after registration without authenticating', () => {
    component.name.set('Reader');
    component.email.set('reader@example.com');
    component.password.set('password');

    component.onSubmit(new Event('submit'));

    expect(auth.register).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
