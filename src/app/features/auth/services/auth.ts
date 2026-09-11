import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { LoginResult } from '../models/auth.models';
import { IS_PUBLIC_REQUEST } from '../interceptors/auth.interceptor';
import { escapeXml } from '../../../shared/utils/xml-utils';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly soapUrl = '/ws';
  readonly accessToken = signal<string | null>(
    sessionStorage.getItem('accessToken')
  );
  readonly onboardingCompleted = signal<boolean | null>(
    this.readStoredOnboardingCompleted()
  );

  login(email: string, password: string) {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="http://soap.com/english-reading/readings">
        <soapenv:Header/>
        <soapenv:Body>
          <read:loginRequest>
            <read:email>${escapeXml(email)}</read:email>
            <read:password>${escapeXml(password)}</read:password>
          </read:loginRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const headers = new HttpHeaders({
      'Content-Type': 'text/xml',
    });

    return this.http
      .post(this.soapUrl, body, {
        headers,
        context: new HttpContext().set(IS_PUBLIC_REQUEST, true),
        responseType: 'text',
      })
      .pipe(map((response) => this.saveLoginResponse(response)));
  }
  register(name: string, email: string, password: string) {
    const body = `
    <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:read="http://soap.com/english-reading/readings">
      <soapenv:Header/>
      <soapenv:Body>
        <read:registerUserRequest>
          <read:name>${escapeXml(name)}</read:name>
          <read:email>${escapeXml(email)}</read:email>
          <read:password>${escapeXml(password)}</read:password>
        </read:registerUserRequest>
      </soapenv:Body>
    </soapenv:Envelope>
  `;

    const headers = new HttpHeaders({
      'Content-Type': 'text/xml',
    });

    return this.http.post(this.soapUrl, body, {
      headers,
      context: new HttpContext().set(IS_PUBLIC_REQUEST, true),
      responseType: 'text',
    });
  }
  saveLoginResponse(responseXml: string): LoginResult {
    const parser = new DOMParser();
    const xml = parser.parseFromString(responseXml, 'text/xml');

    const tokenElement = xml.getElementsByTagNameNS(
      'http://soap.com/english-reading/readings',
      'accessToken'
    )[0];

    const onboardingCompletedValue = xml.getElementsByTagNameNS(
      'http://soap.com/english-reading/readings',
      'onboardingCompleted'
    )[0]?.textContent;

    const token = tokenElement?.textContent;

    if (!token || !['true', 'false'].includes(onboardingCompletedValue ?? '')) {
      throw new Error('Invalid login response');
    }

    const onboardingCompleted = onboardingCompletedValue === 'true';

    this.accessToken.set(token);
    this.onboardingCompleted.set(onboardingCompleted);
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem(
      'onboardingCompleted',
      String(onboardingCompleted)
    );

    return { accessToken: token, onboardingCompleted };
  }

  markOnboardingCompleted(): void {
    this.onboardingCompleted.set(true);
    sessionStorage.setItem('onboardingCompleted', 'true');
  }

  logout(): void {
    this.accessToken.set(null);
    this.onboardingCompleted.set(null);
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('onboardingCompleted');
  }

  private readStoredOnboardingCompleted(): boolean | null {
    const value = sessionStorage.getItem('onboardingCompleted');
    return value === 'true' ? true : value === 'false' ? false : null;
  }
}
