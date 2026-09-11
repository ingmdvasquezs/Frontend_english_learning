import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  InitialVocabularyTest,
  VocabularyClassification,
} from '../models/onboarding.models';
import { escapeXml } from '../../../shared/utils/xml-utils';

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly http = inject(HttpClient);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';

  parseInitialVocabularyTest(responseXml: string): InitialVocabularyTest {
    const parser = new DOMParser();
    const xml = parser.parseFromString(responseXml, 'text/xml');

    const testId =
      xml.getElementsByTagNameNS(this.namespace, 'testId')[0]?.textContent ?? '';

    const text =
      xml.getElementsByTagNameNS(this.namespace, 'text')[0]?.textContent ?? '';

    const selectableWords = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'selectableWords')
    )
      .map((element) => element.textContent ?? '')
      .filter((word) => word.length > 0);

    return {
      testId,
      text,
      selectableWords,
    };
  }
  completeInitialVocabularyTest(
    testId: string,
    classifications: VocabularyClassification[]
  ) {
    const classificationsXml = classifications
      .map(
        ({ word, status }) => `
          <read:classifications>
            <read:word>${escapeXml(word)}</read:word>
            <read:status>${status}</read:status>
          </read:classifications>`
      )
      .join('');

    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="http://soap.com/english-reading/readings">
        <soapenv:Header/>
        <soapenv:Body>
          <read:completeInitialVocabularyTestRequest>
            <read:testId>${escapeXml(testId)}</read:testId>
            ${classificationsXml}
          </read:completeInitialVocabularyTestRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const headers = new HttpHeaders({
      'Content-Type': 'text/xml',
    });

    return this.http.post(this.soapUrl, body, {
      headers,
      responseType: 'text',
    });
  }

  getInitialVocabularyTest() {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="http://soap.com/english-reading/readings">

        <soapenv:Header/>

        <soapenv:Body>
          <read:getInitialVocabularyTestRequest/>
        </soapenv:Body>

      </soapenv:Envelope>
    `;

    const headers = new HttpHeaders({
      'Content-Type': 'text/xml',
    });

    return this.http.post(this.soapUrl, body, {
      headers,
      responseType: 'text',
    });
  }
}
