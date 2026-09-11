import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { DictionaryService } from './dictionary';

describe('DictionaryService', () => {
  let service: DictionaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
      ],
    });
    service = TestBed.inject(DictionaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('parses translation from the namespaced lookupWord SOAP response', () => {
    const response = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <lookupWordResponse xmlns="http://soap.com/english-reading/readings">
            <word>failure</word>
            <normalizedWord>failure</normalizedWord>
            <translation>Fracaso</translation>
            <meanings>
              <partOfSpeech>noun</partOfSpeech>
              <definitions>
                <definition>Lack of success.</definition>
              </definitions>
            </meanings>
          </lookupWordResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    expect(service.parseLookupWordResponse(response).translation).toBe('Fracaso');
  });

  it('parses example and exampleTranslation from definitions when present', () => {
    const response = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <lookupWordResponse xmlns="http://soap.com/english-reading/readings">
            <word>would</word>
            <normalizedWord>would</normalizedWord>
            <translation></translation>
            <phonetic>/wʊd/</phonetic>
            <meanings>
              <partOfSpeech>verb</partOfSpeech>
              <definitions>
                <definition>Used to indicate wish or desire.</definition>
                <example>I would like to travel next year.</example>
                <exampleTranslation>Me gustaría viajar el próximo año.</exampleTranslation>
              </definitions>
            </meanings>
          </lookupWordResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const parsed = service.parseLookupWordResponse(response);
    expect(parsed.word).toBe('would');
    expect(parsed.translation).toBe('');
    expect(parsed.phonetic).toBe('/wʊd/');
    expect(parsed.meanings[0].definitions[0].example).toBe('I would like to travel next year.');
    expect(parsed.meanings[0].definitions[0].exampleTranslation).toBe('Me gustaría viajar el próximo año.');
  });
});
