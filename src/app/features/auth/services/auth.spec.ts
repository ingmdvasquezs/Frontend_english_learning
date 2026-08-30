import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(Auth);
  });

  it('uses the backend login response as the onboarding source of truth', () => {
    const response = `
      <read:loginResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:accessToken>token-1</read:accessToken>
        <read:onboardingCompleted>false</read:onboardingCompleted>
      </read:loginResponse>`;

    expect(service.saveLoginResponse(response)).toEqual({
      accessToken: 'token-1',
      onboardingCompleted: false,
    });
    expect(service.accessToken()).toBe('token-1');
    expect(service.onboardingCompleted()).toBe(false);
  });

  it('marks onboarding complete only when explicitly requested', () => {
    service.markOnboardingCompleted();

    expect(service.onboardingCompleted()).toBe(true);
    expect(sessionStorage.getItem('onboardingCompleted')).toBe('true');
  });

  it('clears the complete authentication session on logout', () => {
    localStorage.setItem('english-reading-theme', 'dark');
    service.saveLoginResponse(`<read:loginResponse xmlns:read="http://soap.com/english-reading/readings"><read:accessToken>token</read:accessToken><read:onboardingCompleted>true</read:onboardingCompleted></read:loginResponse>`);
    service.logout();
    expect(service.accessToken()).toBeNull();
    expect(service.onboardingCompleted()).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('english-reading-theme')).toBe('dark');
  });
});
