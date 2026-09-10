import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { Auth } from '../../auth/services/auth';
import {
  RegisteredReading,
  DeleteReadingResponse,
  UserReading,
  UserReadingsPage,
} from '../models/library.models';
import { parseReadingProgressStatus } from '../../../shared/models/reading-progress-status';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';

  listUserReadings(page = 0, size = 20) {
    const token = this.requireToken();
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:listUserReadingsRequest>
            <read:page>${page}</read:page>
            <read:size>${size}</read:size>
          </read:listUserReadingsRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http.post(this.soapUrl, body, {
      headers: this.authenticatedHeaders(token),
      responseType: 'text',
    });
  }

  registerReading(title: string, content: string, language: string) {
    const token = this.requireToken();
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:registerReadingRequest>
            <read:title>${this.escapeXml(title)}</read:title>
            <read:content>${this.escapeXml(content)}</read:content>
            <read:language>${this.escapeXml(language)}</read:language>
          </read:registerReadingRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http.post(this.soapUrl, body, {
      headers: this.authenticatedHeaders(token),
      responseType: 'text',
    });
  }

  deleteReading(readingId: string) {
    const token = this.requireToken();
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:deleteReadingRequest>
            <read:readingId>${this.escapeXml(readingId)}</read:readingId>
          </read:deleteReadingRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http.post(this.soapUrl, body, {
      headers: this.authenticatedHeaders(token),
      responseType: 'text',
    }).pipe(
      map((response) => this.parseDeleteReadingResponse(response)),
      catchError((error: unknown) => {
        if (error instanceof ReadingNotFoundSoapError) return throwError(() => error);
        if (error instanceof HttpErrorResponse && typeof error.error === 'string' && this.isReadingNotFoundFault(error.error)) {
          return throwError(() => new ReadingNotFoundSoapError());
        }
        return throwError(() => error);
      })
    );
  }

  parseUserReadings(responseXml: string): UserReadingsPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readingElements = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    );

    const readings: UserReading[] = readingElements.map((element) => ({
      readingId: this.getRequiredValue(element, 'readingId'),
      title: this.getRequiredValue(element, 'title'),
      language: this.getRequiredValue(element, 'language'),
      createdAt: this.getOptionalValue(element, 'createdAt'),
      uniqueWords: this.getOptionalCount(element, 'uniqueWords'),
      knownWords: this.getOptionalCount(element, 'knownWords'),
      learningWords: this.getOptionalCount(element, 'learningWords'),
      explicitNewWords: this.getOptionalCount(element, 'explicitNewWords'),
      ignoredWords: this.getOptionalCount(element, 'ignoredWords'),
      unclassifiedWords: this.getOptionalCount(element, 'unclassifiedWords'),
      vocabularyFitPercentage: this.getOptionalPercentage(
        element,
        'vocabularyFitPercentage'
      ),
      classificationConfidencePercentage: this.getOptionalPercentage(
        element,
        'classificationConfidencePercentage'
      ),
      progressStatus: parseReadingProgressStatus(
        this.getOptionalValue(element, 'progressStatus')
      ),
    }));

    return {
      page: Number(this.getRequiredValue(xml, 'page')),
      size: Number(this.getRequiredValue(xml, 'size')),
      totalElements: Number(this.getRequiredValue(xml, 'totalElements')),
      readings,
    };
  }

  parseRegisteredReadingResponse(responseXml: string): RegisteredReading {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    return {
      readingId: this.getRequiredValue(xml, 'readingId'),
      title: this.getRequiredValue(xml, 'title'),
      language: this.getRequiredValue(xml, 'language'),
      createdAt: this.getRequiredValue(xml, 'createdAt'),
    };
  }

  parseDeleteReadingResponse(responseXml: string): DeleteReadingResponse {
    if (this.isReadingNotFoundFault(responseXml)) throw new ReadingNotFoundSoapError();
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const success = this.getRequiredValue(xml, 'success').trim();
    if (success !== 'true' && success !== 'false') {
      throw new Error('Invalid SOAP response: invalid success');
    }
    return { success: success === 'true' };
  }

  private getRequiredValue(parent: Element | Document, name: string): string {
    const value = this.getOptionalValue(parent, name);
    if (value === null) {
      throw new Error(`Invalid SOAP response: missing ${name}`);
    }
    return value;
  }

  private getOptionalValue(
    parent: Element | Document,
    name: string
  ): string | null {
    return (
      parent.getElementsByTagNameNS(this.namespace, name)[0]?.textContent ?? null
    );
  }

  private getOptionalCount(parent: Element | Document, name: string): number {
    const value = this.getOptionalValue(parent, name);
    if (value === null || value.trim() === '') return 0;
    const count = Number(value);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  private getOptionalPercentage(
    parent: Element | Document,
    name: string
  ): number | null {
    const value = this.getOptionalValue(parent, name);
    if (value === null || value.trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100
      ? number
      : null;
  }

  private isReadingNotFoundFault(responseXml: string): boolean {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const fault = xml.getElementsByTagNameNS('http://schemas.xmlsoap.org/soap/envelope/', 'Fault')[0];
    if (!fault) return false;
    const faultString = Array.from(fault.getElementsByTagName('*'))
      .find((element) => element.localName === 'faultstring')?.textContent?.trim();
    return faultString === 'Reading not found';
  }

  private requireToken(): string {
    const token = this.auth.accessToken();
    if (!token) {
      throw new Error('Authentication token is missing');
    }
    return token;
  }

  private authenticatedHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'text/xml',
      Authorization: `Bearer ${token}`,
    });
  }

  private escapeXml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }
}

export class ReadingNotFoundSoapError extends Error {
  readonly code = 'READING_NOT_FOUND';

  constructor() {
    super('Reading not found');
    this.name = 'ReadingNotFoundSoapError';
  }
}
