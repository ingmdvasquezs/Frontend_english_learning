import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { escapeXml } from '../utils/xml-utils';

export interface DictionaryDefinition {
  definition: string;
  example: string | null;
  exampleTranslation?: string | null;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryWord {
  word: string;
  normalizedWord: string;
  translation: string;
  phonetic: string | null;
  audioUrl: string | null;
  meanings: DictionaryMeaning[];
}

@Injectable({
  providedIn: 'root',
})
export class DictionaryService {
  private readonly http = inject(HttpClient);

  private readonly soapUrl = '/ws';
  private readonly namespace =
    'http://soap.com/english-reading/readings';
  private readonly soapNamespace =
    'http://schemas.xmlsoap.org/soap/envelope/';

  lookupWord(word: string) {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:lookupWordRequest>
            <read:word>${escapeXml(word)}</read:word>
          </read:lookupWordRequest>
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

  parseLookupWordResponse(responseXml: string): DictionaryWord {
    const parser = new DOMParser();
    const xml = parser.parseFromString(responseXml, 'text/xml');

    const fault =
      xml.getElementsByTagNameNS(this.soapNamespace, 'Fault')[0] ??
      Array.from(xml.getElementsByTagName('*')).find((el) => el.localName === 'Fault');
    if (fault) {
      const faultString =
        Array.from(fault.getElementsByTagName('*'))
          .find((el) => el.localName === 'faultstring')
          ?.textContent?.trim() ?? 'SOAP Fault';
      throw new Error(`SOAP Fault: ${faultString}`);
    }

    const getFirstValue = (
      parent: Element | Document,
      name: string
    ): string | null => {
      const element =
        parent.getElementsByTagNameNS(this.namespace, name)[0] ??
        parent.getElementsByTagName(name)[0] ??
        Array.from(parent.getElementsByTagName('*')).find(
          (el) => el.localName === name
        );
      return element?.textContent?.trim() ?? null;
    };

    const meaningElements =
      xml.getElementsByTagNameNS(this.namespace, 'meanings').length > 0
        ? Array.from(xml.getElementsByTagNameNS(this.namespace, 'meanings'))
        : Array.from(xml.getElementsByTagName('*')).filter(
            (el) => el.localName === 'meanings'
          );

    const meanings: DictionaryMeaning[] = meaningElements.map(
      (meaningElement) => {
        const definitionElements =
          meaningElement.getElementsByTagNameNS(this.namespace, 'definitions').length > 0
            ? Array.from(meaningElement.getElementsByTagNameNS(this.namespace, 'definitions'))
            : Array.from(meaningElement.getElementsByTagName('*')).filter(
                (el) => el.localName === 'definitions'
              );

        const definitions: DictionaryDefinition[] =
          definitionElements.map((definitionElement) => ({
            definition:
              getFirstValue(
                definitionElement,
                'definition'
              ) ?? '',
            example: getFirstValue(
              definitionElement,
              'example'
            ),
            exampleTranslation: getFirstValue(
              definitionElement,
              'exampleTranslation'
            ),
          }));

        return {
          partOfSpeech:
            getFirstValue(
              meaningElement,
              'partOfSpeech'
            ) ?? '',
          definitions,
        };
      }
    );

    return {
      word: getFirstValue(xml, 'word') ?? '',
      normalizedWord:
        getFirstValue(xml, 'normalizedWord') ?? '',
      translation:
        getFirstValue(xml, 'translation') ?? '',
      phonetic: getFirstValue(xml, 'phonetic'),
      audioUrl: getFirstValue(xml, 'audioUrl'),
      meanings,
    };
  }
}
