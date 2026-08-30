import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import { Auth } from '../../auth/services/auth';
import { ReaderData, ReaderToken } from '../models/reader.models';
import { CompleteReadingResult } from '../models/reader.models';
import { parseReadingProgressStatus } from '../../../shared/models/reading-progress-status';

@Injectable({
  providedIn: 'root',
})
export class ReaderService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';
  private readonly soapNamespace =
    'http://schemas.xmlsoap.org/soap/envelope/';

  getReaderData(readingId: string) {
    const token = this.requireToken();

    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:getReadingReaderDataRequest>
            <read:readingId>${this.escapeXml(readingId)}</read:readingId>
          </read:getReadingReaderDataRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.postSoap(body, token);
  }

  setVocabularyStatus(
    word: string,
    language: string,
    status: VocabularyStatus
  ) {
    const token = this.requireToken();
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:setVocabularyStatusRequest>
            <read:word>${this.escapeXml(word)}</read:word>
            <read:language>${this.escapeXml(language)}</read:language>
            <read:status>${status}</read:status>
          </read:setVocabularyStatusRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.postSoap(body, token);
  }

  completeReading(readingId: string) {
    const token = this.requireToken();
    const body = `
      <soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:completeReadingRequest>
            <read:readingId>${this.escapeXml(readingId)}</read:readingId>
          </read:completeReadingRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.postSoap(body, token);
  }

  parseReaderData(responseXml: string): ReaderData {
    const xml = this.parseXml(responseXml);

    const tokenElements = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'tokens')
    );

    const tokens: ReaderToken[] = tokenElements.map((element) => ({
      value: this.getRequiredValue(element, 'value'),
      normalizedValue: this.getOptionalValue(element, 'normalizedValue'),
      type: this.getTokenType(element),
      status: this.getVocabularyStatus(element),
    }));

    return {
      readingId: this.getRequiredValue(xml, 'readingId'),
      title: this.getRequiredValue(xml, 'title'),
      language: this.getRequiredValue(xml, 'language'),
      progressStatus: parseReadingProgressStatus(
        this.getOptionalValue(xml, 'progressStatus')
      ),
      tokens,
    };
  }

  parseCompleteReading(responseXml: string): CompleteReadingResult {
    const xml = this.parseXml(responseXml);
    const status = parseReadingProgressStatus(
      this.getRequiredValue(xml, 'status')
    );
    if (status !== 'COMPLETED') {
      throw new Error('Invalid SOAP response: completion status expected');
    }
    return {
      readingId: this.getRequiredValue(xml, 'readingId'),
      status,
      startedAt: this.getRequiredValue(xml, 'startedAt'),
      completedAt: this.getRequiredValue(xml, 'completedAt'),
    };
  }

  private getTokenType(element: Element): ReaderToken['type'] {
    const value = this.getRequiredValue(element, 'type');
    if (!['WORD', 'PUNCTUATION', 'WHITESPACE'].includes(value)) {
      throw new Error('Invalid SOAP response: invalid token type');
    }
    return value as ReaderToken['type'];
  }

  private getVocabularyStatus(element: Element): VocabularyStatus | null {
    const value = this.getOptionalValue(element, 'status');
    if (value === null) {
      return null;
    }
    if (!['NEW', 'LEARNING', 'KNOWN', 'IGNORED'].includes(value)) {
      throw new Error('Invalid SOAP response: invalid vocabulary status');
    }
    return value as VocabularyStatus;
  }

  private postSoap(body: string, token: string) {
    return this.http
      .post(this.soapUrl, body, {
        headers: new HttpHeaders({
          'Content-Type': 'text/xml',
          Authorization: `Bearer ${token}`,
        }),
        responseType: 'text',
      })
      .pipe(
        map((response) => {
          this.parseXml(response);
          return response;
        })
      );
  }

  private parseXml(responseXml: string): Document {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const fault = xml.getElementsByTagNameNS(this.soapNamespace, 'Fault')[0];
    const parserError = xml.getElementsByTagName('parsererror')[0];
    if (fault || parserError) {
      throw new Error('Invalid SOAP response');
    }
    return xml;
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

  private requireToken(): string {
    const token = this.auth.accessToken();
    if (!token) {
      throw new Error('Authentication token is missing');
    }
    return token;
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
