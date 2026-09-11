import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import { escapeXml } from '../../../shared/utils/xml-utils';
import {
  UserVocabularyPage,
  VocabularyEntry,
  VocabularySummary,
} from '../models/vocabulary.models';

@Injectable({ providedIn: 'root' })
export class VocabularyService {
  private readonly http = inject(HttpClient);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';
  private readonly soapNamespace = 'http://schemas.xmlsoap.org/soap/envelope/';

  listUserVocabulary(
    page = 0,
    size = 20,
    status?: VocabularyStatus | null,
    search?: string | null
  ): Observable<UserVocabularyPage> {
    const trimmedSearch = search?.trim() ?? '';
    const statusXml =
      status && this.isValidStatus(status)
        ? `<read:status>${status}</read:status>`
        : '';
    const searchXml = trimmedSearch
      ? `<read:search>${escapeXml(trimmedSearch)}</read:search>`
      : '';

    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:listUserVocabularyRequest>
            <read:page>${page}</read:page>
            <read:size>${size}</read:size>
            ${statusXml}
            ${searchXml}
          </read:listUserVocabularyRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http
      .post(this.soapUrl, body, {
        headers: this.soapHeaders(),
        responseType: 'text',
      })
      .pipe(map((response) => this.parseUserVocabulary(response)));
  }

  parseUserVocabulary(responseXml: string): UserVocabularyPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');

    const fault =
      xml.getElementsByTagNameNS(this.soapNamespace, 'Fault')[0] ??
      Array.from(xml.getElementsByTagName('*')).find(
        (element) => element.localName === 'Fault'
      );
    if (fault) {
      const faultString =
        Array.from(fault.getElementsByTagName('*'))
          .find((element) => element.localName === 'faultstring')
          ?.textContent?.trim() ?? 'SOAP Fault';
      throw new Error(`SOAP Fault: ${faultString}`);
    }

    const page = this.parseInteger(this.getRequiredValue(xml, 'page'), 0);
    const size = this.parseInteger(this.getRequiredValue(xml, 'size'), 20);
    const totalElements = this.parseInteger(
      this.getRequiredValue(xml, 'totalElements'),
      0
    );

    const summaryElement =
      xml.getElementsByTagNameNS(this.namespace, 'summary')[0] ??
      Array.from(xml.getElementsByTagName('*')).find(
        (element) => element.localName === 'summary'
      );
    if (!summaryElement) {
      throw new Error('Invalid SOAP response: missing summary');
    }

    const summary: VocabularySummary = {
      totalCount: this.parseInteger(
        this.getRequiredValue(summaryElement, 'totalCount'),
        0
      ),
      newCount: this.parseInteger(
        this.getRequiredValue(summaryElement, 'newCount'),
        0
      ),
      learningCount: this.parseInteger(
        this.getRequiredValue(summaryElement, 'learningCount'),
        0
      ),
      knownCount: this.parseInteger(
        this.getRequiredValue(summaryElement, 'knownCount'),
        0
      ),
      ignoredCount: this.parseInteger(
        this.getRequiredValue(summaryElement, 'ignoredCount'),
        0
      ),
    };

    const entryNodes =
      xml.getElementsByTagNameNS(this.namespace, 'entries').length > 0
        ? Array.from(xml.getElementsByTagNameNS(this.namespace, 'entries'))
        : Array.from(xml.getElementsByTagName('*')).filter(
            (element) => element.localName === 'entries'
          );

    const entries: VocabularyEntry[] = entryNodes.map((element) => {
      const rawStatus = this.getRequiredValue(element, 'status');
      if (!this.isValidStatus(rawStatus)) {
        throw new Error(`Invalid SOAP response: invalid status "${rawStatus}"`);
      }

      return {
        entryId: this.getRequiredValue(element, 'entryId'),
        wordId: this.getRequiredValue(element, 'wordId'),
        word: this.getRequiredValue(element, 'word'),
        language: this.getRequiredValue(element, 'language'),
        status: rawStatus as VocabularyStatus,
        firstSeenAt: this.getOptionalValue(element, 'firstSeenAt'),
      };
    });

    return {
      page,
      size,
      totalElements,
      summary,
      entries,
    };
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
    const element =
      parent.getElementsByTagNameNS(this.namespace, name)[0] ??
      parent.getElementsByTagName(name)[0] ??
      Array.from(parent.getElementsByTagName('*')).find(
        (el) => el.localName === name
      );
    return element?.textContent ?? null;
  }

  private parseInteger(value: string | null, fallback: number): number {
    if (value === null || value.trim() === '') return fallback;
    const count = Number(value);
    return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
  }

  private isValidStatus(status: string): status is VocabularyStatus {
    return ['NEW', 'LEARNING', 'KNOWN', 'IGNORED'].includes(status);
  }

  private soapHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'text/xml',
    });
  }
}
