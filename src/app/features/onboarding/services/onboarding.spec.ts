import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { OnboardingService } from './onboarding';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OnboardingService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token' } },
      ],
    });
    service = TestBed.inject(OnboardingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('serializes every explicit classification in the SOAP request', () => {
    service
      .completeInitialVocabularyTest('test-1', [
        { word: 'fresh', status: 'NEW' },
        { word: 'study', status: 'LEARNING' },
        { word: 'known', status: 'KNOWN' },
        { word: 'skip', status: 'IGNORED' },
      ])
      .subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:testId>test-1</read:testId>');
    expect(request.request.body).toContain('<read:word>fresh</read:word>');
    expect(request.request.body).toContain('<read:status>NEW</read:status>');
    expect(request.request.body).toContain('<read:status>LEARNING</read:status>');
    expect(request.request.body).toContain('<read:status>KNOWN</read:status>');
    expect(request.request.body).toContain('<read:status>IGNORED</read:status>');
    expect(request.request.body).not.toContain('<read:knownWords>');
    expect(
      request.request.body.match(/<read:classifications>/g)
    ).toHaveLength(4);
    request.flush('<response/>');
  });
});
