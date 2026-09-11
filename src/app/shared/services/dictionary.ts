import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface DictionaryDefinition {
  definition: string;
  example: string | null;
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

  lookupWord(word: string) {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
          xmlns:read="http://soap.com/english-reading/readings">
        <soapenv:Header/>
        <soapenv:Body>
          <read:lookupWordRequest>
            <read:word>${word}</read:word>
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

    const getFirstValue = (
      parent: Element | Document,
      name: string
    ): string | null => {
      return (
        parent.getElementsByTagNameNS(
          this.namespace,
          name
        )[0]?.textContent ?? null
      );
    };

    const meaningElements = Array.from(
      xml.getElementsByTagNameNS(
        this.namespace,
        'meanings'
      )
    );

    const meanings: DictionaryMeaning[] = meaningElements.map(
      (meaningElement) => {
        const definitionElements = Array.from(
          meaningElement.getElementsByTagNameNS(
            this.namespace,
            'definitions'
          )
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
