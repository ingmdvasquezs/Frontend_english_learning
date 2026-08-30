import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../features/auth/services/auth';
import { DictionaryService } from './dictionary';

describe('DictionaryService', () => {
  let service: DictionaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: Auth, useValue: { accessToken: () => 'token' } },
      ],
    });
    service = TestBed.inject(DictionaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
