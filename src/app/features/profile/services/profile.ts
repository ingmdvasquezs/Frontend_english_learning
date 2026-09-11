import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, tap, throwError } from 'rxjs';
import { AliasAlreadyInUseError, UpdateUserProfile, UserProfile } from '../models/profile.models';
import { escapeXml } from '../../../shared/utils/xml-utils';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';
  private readonly soapNamespace = 'http://schemas.xmlsoap.org/soap/envelope/';

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  getMyProfile() {
    const body = `<soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}"><soapenv:Header/><soapenv:Body><read:getMyProfileRequest/></soapenv:Body></soapenv:Envelope>`;
    return this.post(body);
  }

  loadProfile(force = false): void {
    if (this.loading() || (!force && this.profile())) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.getMyProfile().subscribe({
      next: (response) => {
        try { this.profile.set(this.parseProfile(response)); }
        catch { this.loadError.set('No pudimos cargar tu perfil.'); }
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No pudimos cargar tu perfil.');
        this.loading.set(false);
      },
    });
  }

  updateMyProfile(profile: UpdateUserProfile) {
    const body = `<soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header/><soapenv:Body><read:updateMyProfileRequest><read:name>${escapeXml(profile.name)}</read:name>${this.optionalText('alias', profile.alias)}${this.optionalNumber('age', profile.age)}${this.optionalText('nativeLanguage', profile.nativeLanguage)}<read:learningLanguage>${escapeXml(profile.learningLanguage)}</read:learningLanguage></read:updateMyProfileRequest></soapenv:Body></soapenv:Envelope>`;
    return this.post(body).pipe(
      tap(() => {
        const current = this.profile();
        if (current) this.profile.set({ ...profile, email: current.email });
      })
    );
  }

  parseProfile(responseXml: string): UserProfile {
    const xml = this.parseXml(responseXml);
    return {
      name: this.required(xml, 'name'),
      alias: this.optional(xml, 'alias'),
      age: this.optionalAge(xml),
      nativeLanguage: this.optional(xml, 'nativeLanguage'),
      learningLanguage: this.required(xml, 'learningLanguage'),
      email: this.required(xml, 'email'),
    };
  }

  clearProfile(): void {
    this.profile.set(null);
    this.loading.set(false);
    this.loadError.set(null);
  }

  private post(body: string) {
    return this.http.post(this.soapUrl, body, {
      headers: new HttpHeaders({ 'Content-Type': 'text/xml' }),
      responseType: 'text',
    }).pipe(
      map((response) => { this.parseXml(response); return response; }),
      catchError((error: HttpErrorResponse | Error) => {
        const raw = error instanceof HttpErrorResponse && typeof error.error === 'string' ? error.error : error.message;
        return throwError(() => raw.includes('AliasAlreadyInUse') ? new AliasAlreadyInUseError() : error);
      })
    );
  }

  private parseXml(value: string): Document {
    const xml = new DOMParser().parseFromString(value, 'text/xml');
    const parserError = xml.getElementsByTagName('parsererror')[0];
    const fault = xml.getElementsByTagNameNS(this.soapNamespace, 'Fault')[0];
    if (fault) {
      const text = fault.textContent ?? '';
      if (text.includes('AliasAlreadyInUse')) throw new AliasAlreadyInUseError();
      throw new Error('SOAP Fault');
    }
    if (parserError) throw new Error('Invalid SOAP response');
    return xml;
  }

  private optional(parent: Document, name: string): string | null {
    const element = parent.getElementsByTagNameNS(this.namespace, name)[0];
    if (!element || element.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil') === 'true') return null;
    return element.textContent?.trim() || null;
  }

  private required(parent: Document, name: string): string {
    const value = this.optional(parent, name);
    if (!value) throw new Error(`Invalid SOAP response: missing ${name}`);
    return value;
  }

  private optionalAge(parent: Document): number | null {
    const raw = this.optional(parent, 'age');
    if (raw === null) return null;
    const age = Number(raw);
    if (!Number.isInteger(age)) throw new Error('Invalid SOAP response: invalid age');
    return age;
  }

  private optionalText(name: string, value: string | null): string {
    return value === null ? `<read:${name} xsi:nil="true"/>` : `<read:${name}>${escapeXml(value)}</read:${name}>`;
  }

  private optionalNumber(name: string, value: number | null): string {
    return value === null ? `<read:${name} xsi:nil="true"/>` : `<read:${name}>${value}</read:${name}>`;
  }
}
