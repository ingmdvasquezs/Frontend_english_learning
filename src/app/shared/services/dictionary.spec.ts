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
});
