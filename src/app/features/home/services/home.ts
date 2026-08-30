import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Auth } from '../../auth/services/auth';
import {
  PlatformReadingRecommendationsPage,
  RecommendedPlatformReading,
} from '../models/home.models';
import { parseReadingProgressStatus } from '../../../shared/models/reading-progress-status';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';

  recommendPlatformReadings(page = 0, size = 4) {
    const token = this.auth.accessToken();
    if (!token) {
      throw new Error('Authentication token is missing');
    }

    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:recommendPlatformReadingsRequest>
            <read:page>${page}</read:page>
            <read:size>${size}</read:size>
          </read:recommendPlatformReadingsRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http.post(this.soapUrl, body, {
      headers: new HttpHeaders({
        'Content-Type': 'text/xml',
        Authorization: `Bearer ${token}`,
      }),
      responseType: 'text',
    });
  }

  parseRecommendations(
    responseXml: string
  ): PlatformReadingRecommendationsPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readingElements = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    );

    const readings: RecommendedPlatformReading[] = readingElements.map(
      (element) => ({
        readingId: this.getRequiredValue(element, 'readingId'),
        title: this.getRequiredValue(element, 'title'),
        language: this.getRequiredValue(element, 'language'),
        editorialLevel: this.getRequiredValue(element, 'editorialLevel'),
        category: this.getRequiredValue(element, 'category'),
        createdAt: this.getOptionalValue(element, 'createdAt'),
        uniqueWords: this.getRequiredNumber(element, 'uniqueWords'),
        knownWords: this.getRequiredNumber(element, 'knownWords'),
        learningWords: this.getRequiredNumber(element, 'learningWords'),
        explicitNewWords: this.getRequiredNumber(element, 'explicitNewWords'),
        ignoredWords: this.getRequiredNumber(element, 'ignoredWords'),
        unclassifiedWords: this.getRequiredNumber(element, 'unclassifiedWords'),
        vocabularyFitPercentage: this.getRequiredNumber(
          element,
          'vocabularyFitPercentage'
        ),
        classificationConfidencePercentage: this.getRequiredNumber(
          element,
          'classificationConfidencePercentage'
        ),
        progressStatus: parseReadingProgressStatus(
          this.getOptionalValue(element, 'progressStatus')
        ),
      })
    );

    return {
      page: this.getRequiredNumber(xml, 'page'),
      size: this.getRequiredNumber(xml, 'size'),
      totalElements: this.getRequiredNumber(xml, 'totalElements'),
      readings,
    };
  }

  private getRequiredNumber(
    parent: Element | Document,
    name: string
  ): number {
    const rawValue = this.getRequiredValue(parent, name);
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid SOAP response: ${name} is not numeric`);
    }
    return value;
  }

  private getRequiredValue(parent: Element | Document, name: string): string {
    const value = this.getOptionalValue(parent, name);
    if (value === null || value.trim() === '') {
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
}
