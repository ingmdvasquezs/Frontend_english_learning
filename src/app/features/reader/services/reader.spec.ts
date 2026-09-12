import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../auth/services/auth';
import { authInterceptor } from '../../auth/interceptors/auth.interceptor';
import { ReaderService } from './reader';

describe('ReaderService', () => {
  let service: ReaderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReaderService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { accessToken: () => 'token', logout: () => undefined } },
      ],
    });
    service = TestBed.inject(ReaderService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('generates an authenticated getReadingReaderData request without userId', () => {
    service.getReaderData('reading&1').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getReadingReaderDataRequest>');
    expect(request.request.body).toContain(
      '<read:readingId>reading&amp;1</read:readingId>'
    );
    expect(request.request.body).not.toContain('userId');
    request.flush('<response/>');
  });

  it('parses tokens in order preserving whitespace, punctuation and null status', () => {
    const result = service.parseReaderData(readerResponse());

    expect(result.readingId).toBe('reading-1');
    expect(result.progressStatus).toBe('IN_PROGRESS');
    expect(result.currentPartOrdinal).toBe(7);
    expect(result.paginationVersion).toBe(1);
    expect(result.tokens.map((token) => token.value).join('')).toBe(
      'Learning, learning!\nDone'
    );
    expect(result.tokens).toEqual([
      {
        value: 'Learning',
        normalizedValue: 'learning',
        type: 'WORD',
        status: null,
      },
      {
        value: ',',
        normalizedValue: null,
        type: 'PUNCTUATION',
        status: null,
      },
      {
        value: ' ',
        normalizedValue: null,
        type: 'WHITESPACE',
        status: null,
      },
      {
        value: 'learning',
        normalizedValue: 'learning',
        type: 'WORD',
        status: 'NEW',
      },
      {
        value: '!',
        normalizedValue: null,
        type: 'PUNCTUATION',
        status: null,
      },
      {
        value: '\n',
        normalizedValue: null,
        type: 'WHITESPACE',
        status: null,
      },
      {
        value: 'Done',
        normalizedValue: 'done',
        type: 'WORD',
        status: 'KNOWN',
      },
    ]);
  });

  it('parses absent and completed reader progress', () => {
    expect(service.parseReaderData(readerResponse().replace('<read:progressStatus>IN_PROGRESS</read:progressStatus>', '')).progressStatus).toBeNull();
    expect(service.parseReaderData(readerResponse().replace('IN_PROGRESS', 'COMPLETED')).progressStatus).toBe('COMPLETED');
  });

  it('maps legacy reader data without Part fields to null rather than zero', () => {
    const response = readerResponse()
      .replace('<read:currentPartOrdinal>7</read:currentPartOrdinal>', '')
      .replace('<read:paginationVersion>1</read:paginationVersion>', '');

    const result = service.parseReaderData(response);

    expect(result.currentPartOrdinal).toBeNull();
    expect(result.paginationVersion).toBeNull();
    expect(result.currentPartOrdinal).not.toBe(0);
    expect(result.paginationVersion).not.toBe(0);
  });

  it('serializes an authenticated updateReadingProgress with the required Part pair', () => {
    service.updateReadingProgress({
      readingId: 'reading&1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 7,
      paginationVersion: 1,
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    const body = request.request.body as string;
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(body).toContain('<read:updateReadingProgressRequest>');
    expect(body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(body).toContain('<read:progressStatus>IN_PROGRESS</read:progressStatus>');
    expect(body).toContain('<read:currentPartOrdinal>7</read:currentPartOrdinal>');
    expect(body).toContain('<read:paginationVersion>1</read:paginationVersion>');
    expect(body.indexOf('<read:currentPartOrdinal>')).toBeLessThan(
      body.indexOf('<read:paginationVersion>')
    );
    request.flush('<response/>');
  });

  it('turns an updateReadingProgress SOAP Fault into the existing observable error flow', () => {
    let failed = false;
    service.updateReadingProgress({
      readingId: 'reading-1',
      progressStatus: 'IN_PROGRESS',
      currentPartOrdinal: 2,
      paginationVersion: 1,
    }).subscribe({ error: () => (failed = true) });

    httpTesting.expectOne('/ws').flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body>
      </soapenv:Envelope>`);

    expect(failed).toBe(true);
  });

  it('sends authenticated completeReading XML and parses timestamps', () => {
    service.completeReading('reading&1').subscribe();
    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:completeReadingRequest>');
    expect(request.request.body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(request.request.body).not.toContain('userId');
    request.flush('<response/>');
    expect(service.parseCompleteReading(`<read:completeReadingResponse xmlns:read="http://soap.com/english-reading/readings"><read:readingId>reading-1</read:readingId><read:status>COMPLETED</read:status><read:startedAt>2026-08-30T10:00:00Z</read:startedAt><read:completedAt>2026-08-30T10:10:00Z</read:completedAt></read:completeReadingResponse>`)).toEqual({ readingId:'reading-1', status:'COMPLETED', startedAt:'2026-08-30T10:00:00Z', completedAt:'2026-08-30T10:10:00Z' });
  });

  it('turns a completeReading SOAP Fault into an observable error', () => {
    let failed = false;
    service.completeReading('reading-1').subscribe({ error: () => (failed = true) });
    httpTesting.expectOne('/ws').flush(`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`);
    expect(failed).toBe(true);
  });

  it.each(['LEARNING', 'KNOWN', 'IGNORED'] as const)(
    'parses explicit %s status',
    (status) => {
      const response = readerResponse().replace(
        '<read:status>KNOWN</read:status>',
        `<read:status>${status}</read:status>`
      );

      expect(service.parseReaderData(response).tokens.at(-1)?.status).toBe(
        status
      );
    }
  );

  it('generates one setVocabularyStatus request with escaped values and no userId', () => {
    service.setVocabularyStatus('Learning & Growth', 'en', 'LEARNING').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:setVocabularyStatusRequest>');
    expect(request.request.body).toContain(
      '<read:word>Learning &amp; Growth</read:word>'
    );
    expect(request.request.body).toContain('<read:language>en</read:language>');
    expect(request.request.body).toContain(
      '<read:status>LEARNING</read:status>'
    );
    expect(request.request.body).not.toContain('userId');
    expect(request.request.body.indexOf('<read:word>')).toBeLessThan(
      request.request.body.indexOf('<read:language>')
    );
    expect(request.request.body.indexOf('<read:language>')).toBeLessThan(
      request.request.body.indexOf('<read:status>')
    );
    request.flush('<response/>');
  });

  it('turns a SOAP Fault into an observable error', () => {
    let failed = false;
    service.setVocabularyStatus('word', 'en', 'KNOWN').subscribe({
      error: () => (failed = true),
    });
    const request = httpTesting.expectOne('/ws');
    request.flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body><soapenv:Fault><faultstring>Failed</faultstring></soapenv:Fault></soapenv:Body>
      </soapenv:Envelope>`);

    expect(failed).toBe(true);
  });

  it('generates an authenticated getReadingComprehensionQuiz request without submissionId', () => {
    service.getReadingComprehensionQuiz('reading&1').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getReadingComprehensionQuizRequest>');
    expect(request.request.body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(request.request.body).not.toContain('<read:submissionId>');
    request.flush(quizAvailableResponse());
  });

  it('generates an authenticated getReadingComprehensionQuiz request with submissionId', () => {
    service.getReadingComprehensionQuiz('reading&1', 'uuid-attempt-1').subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:getReadingComprehensionQuizRequest>');
    expect(request.request.body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(request.request.body).toContain('<read:submissionId>uuid-attempt-1</read:submissionId>');
    request.flush(versionedQuizResponse(1));
  });

  it('parses available=true legacy quiz with selectionVersion as null', () => {
    const quiz = service.parseReadingComprehensionQuiz(quizAvailableResponse());

    expect(quiz.readingId).toBe('reading-1');
    expect(quiz.available).toBe(true);
    expect(quiz.selectionVersion).toBeNull();
    expect(quiz.questions.length).toBe(3);

    expect(quiz.questions[0]).toEqual({
      questionId: 'q-1',
      ordinal: 1,
      questionType: 'FACTUAL',
      prompt: 'What did the main character do?',
      options: [
        { optionId: 'opt-1-1', ordinal: 1, content: 'He walked to the library.' },
        { optionId: 'opt-1-2', ordinal: 2, content: 'He stayed home.' },
        { optionId: 'opt-1-3', ordinal: 3, content: 'He went to work.' },
        { optionId: 'opt-1-4', ordinal: 4, content: 'He took a train.' },
      ],
    });

    expect(quiz.questions[1].questionType).toBe('INFERENCE');
    expect(quiz.questions[2].questionType).toBe('MAIN_IDEA');
    expect((quiz.questions[0].options[0] as unknown as { isCorrect?: unknown }).isCorrect).toBeUndefined();
    expect((quiz.questions[0] as unknown as { explanation?: unknown }).explanation).toBeUndefined();
  });

  it('parses versioned quiz response with selectionVersion', () => {
    const quiz = service.parseReadingComprehensionQuiz(versionedQuizResponse(1));

    expect(quiz.readingId).toBe('reading-1');
    expect(quiz.available).toBe(true);
    expect(quiz.selectionVersion).toBe(1);
    expect(quiz.questions.length).toBe(3);
  });

  it('parses available=false quiz', () => {
    const xml = `
      <read:getReadingComprehensionQuizResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-1</read:readingId>
        <read:available>false</read:available>
      </read:getReadingComprehensionQuizResponse>
    `;
    const quiz = service.parseReadingComprehensionQuiz(xml);
    expect(quiz.readingId).toBe('reading-1');
    expect(quiz.available).toBe(false);
    expect(quiz.selectionVersion).toBeNull();
    expect(quiz.questions).toEqual([]);
  });

  it('generates an authenticated submitComprehensionAttempt request with readingId, submissionId, answers and selectionVersion in XSD order', () => {
    service.submitComprehensionAttempt({
      readingId: 'reading&1',
      submissionId: 'sub-uuid-1',
      selectionVersion: 1,
      answers: [
        { questionId: 'q-1', selectedOptionId: 'opt-1-1' },
        { questionId: 'q-2', selectedOptionId: 'opt-2-3' },
      ],
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.body).toContain('<read:submitComprehensionAttemptRequest>');
    expect(request.request.body).toContain('<read:readingId>reading&amp;1</read:readingId>');
    expect(request.request.body).toContain('<read:submissionId>sub-uuid-1</read:submissionId>');
    expect(request.request.body).toContain('<read:questionId>q-1</read:questionId>');
    expect(request.request.body).toContain('<read:selectedOptionId>opt-1-1</read:selectedOptionId>');
    expect(request.request.body).toContain('<read:questionId>q-2</read:questionId>');
    expect(request.request.body).toContain('<read:selectedOptionId>opt-2-3</read:selectedOptionId>');
    expect(request.request.body).toContain('<read:selectionVersion>1</read:selectionVersion>');

    // Validate XSD sequence order: readingId -> submissionId -> answers -> selectionVersion
    const body = request.request.body;
    const readingIdIdx = body.indexOf('<read:readingId>');
    const submissionIdIdx = body.indexOf('<read:submissionId>');
    const answersIdx = body.indexOf('<read:answers>');
    const versionIdx = body.indexOf('<read:selectionVersion>');
    expect(readingIdIdx).toBeLessThan(submissionIdIdx);
    expect(submissionIdIdx).toBeLessThan(answersIdx);
    expect(answersIdx).toBeLessThan(versionIdx);

    request.flush(submitAttemptResponse());
  });

  it('does not hardcode selectionVersion when submitting comprehension attempt', () => {
    service.submitComprehensionAttempt({
      readingId: 'reading-1',
      submissionId: 'sub-uuid-custom',
      selectionVersion: 2,
      answers: [],
    }).subscribe();

    const request = httpTesting.expectOne('/ws');
    expect(request.request.body).toContain('<read:selectionVersion>2</read:selectionVersion>');
    request.flush(submitAttemptResponse());
  });

  it('parses attempt result preserving exact backend score, questions, options, and explanations', () => {
    const result = service.parseComprehensionAttemptResult(submitAttemptResponse());

    expect(result.attemptId).toBe('att-1');
    expect(result.readingId).toBe('reading-1');
    expect(result.submissionId).toBe('sub-uuid-1');
    expect(result.scorePercentage).toBe(66.67);
    expect(result.correctAnswersCount).toBe(2);
    expect(result.totalQuestionsCount).toBe(3);
    expect(result.submittedAt).toBe('2026-09-12T10:00:00Z');
    expect(result.questions.length).toBe(3);

    expect(result.questions[0]).toEqual({
      questionId: 'q-1',
      ordinal: 1,
      questionType: 'FACTUAL',
      prompt: 'What did the main character do?',
      selectedOptionId: 'opt-1-1',
      correctOptionId: 'opt-1-1',
      isCorrect: true,
      explanation: 'The text clearly states he walked to the library.',
      options: [
        { optionId: 'opt-1-1', ordinal: 1, content: 'He walked to the library.' },
        { optionId: 'opt-1-2', ordinal: 2, content: 'He stayed home.' },
      ],
    });

    expect(result.questions[1].isCorrect).toBe(false);
    expect(result.questions[1].selectedOptionId).toBe('opt-2-1');
    expect(result.questions[1].correctOptionId).toBe('opt-2-2');
  });

  it('turns getReadingComprehensionQuiz SOAP Fault into an observable error', () => {
    let failed = false;
    service.getReadingComprehensionQuiz('reading-1').subscribe({
      error: () => (failed = true),
    });
    const request = httpTesting.expectOne('/ws');
    request.flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <soapenv:Fault>
            <faultcode>soapenv:Client</faultcode>
            <faultstring>Comprehension quiz is only available for platform readings</faultstring>
          </soapenv:Fault>
        </soapenv:Body>
      </soapenv:Envelope>`);
    expect(failed).toBe(true);
  });

  it('turns submitComprehensionAttempt SOAP Fault into an observable error', () => {
    let failed = false;
    service.submitComprehensionAttempt({
      readingId: 'reading-1',
      submissionId: 'uuid',
      selectionVersion: 1,
      answers: [],
    }).subscribe({
      error: () => (failed = true),
    });
    const request = httpTesting.expectOne('/ws');
    request.flush(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <soapenv:Fault>
            <faultcode>soapenv:Client</faultcode>
            <faultstring>Validation failed</faultstring>
          </soapenv:Fault>
        </soapenv:Body>
      </soapenv:Envelope>`);
    expect(failed).toBe(true);
  });

  function readerResponse(): string {
    return `
      <read:getReadingReaderDataResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-1</read:readingId>
        <read:title>Learning Story</read:title>
        <read:language>en</read:language>
        <read:progressStatus>IN_PROGRESS</read:progressStatus>
        <read:currentPartOrdinal>7</read:currentPartOrdinal>
        <read:paginationVersion>1</read:paginationVersion>
        <read:tokens><read:value>Learning</read:value><read:normalizedValue>learning</read:normalizedValue><read:type>WORD</read:type></read:tokens>
        <read:tokens><read:value>,</read:value><read:type>PUNCTUATION</read:type></read:tokens>
        <read:tokens><read:value> </read:value><read:type>WHITESPACE</read:type></read:tokens>
        <read:tokens><read:value>learning</read:value><read:normalizedValue>learning</read:normalizedValue><read:type>WORD</read:type><read:status>NEW</read:status></read:tokens>
        <read:tokens><read:value>!</read:value><read:type>PUNCTUATION</read:type></read:tokens>
        <read:tokens><read:value>\n</read:value><read:type>WHITESPACE</read:type></read:tokens>
        <read:tokens><read:value>Done</read:value><read:normalizedValue>done</read:normalizedValue><read:type>WORD</read:type><read:status>KNOWN</read:status></read:tokens>
      </read:getReadingReaderDataResponse>`;
  }

  function quizAvailableResponse(): string {
    return `
      <read:getReadingComprehensionQuizResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-1</read:readingId>
        <read:available>true</read:available>
        <read:questions>
          <read:questionId>q-1</read:questionId>
          <read:ordinal>1</read:ordinal>
          <read:questionType>FACTUAL</read:questionType>
          <read:prompt>What did the main character do?</read:prompt>
          <read:options>
            <read:optionId>opt-1-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>He walked to the library.</read:content>
          </read:options>
          <read:options>
            <read:optionId>opt-1-2</read:optionId>
            <read:ordinal>2</read:ordinal>
            <read:content>He stayed home.</read:content>
          </read:options>
          <read:options>
            <read:optionId>opt-1-3</read:optionId>
            <read:ordinal>3</read:ordinal>
            <read:content>He went to work.</read:content>
          </read:options>
          <read:options>
            <read:optionId>opt-1-4</read:optionId>
            <read:ordinal>4</read:ordinal>
            <read:content>He took a train.</read:content>
          </read:options>
        </read:questions>
        <read:questions>
          <read:questionId>q-2</read:questionId>
          <read:ordinal>2</read:ordinal>
          <read:questionType>INFERENCE</read:questionType>
          <read:prompt>Why was the character excited?</read:prompt>
          <read:options>
            <read:optionId>opt-2-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>Because it was a sunny day.</read:content>
          </read:options>
        </read:questions>
        <read:questions>
          <read:questionId>q-3</read:questionId>
          <read:ordinal>3</read:ordinal>
          <read:questionType>MAIN_IDEA</read:questionType>
          <read:prompt>What is the central theme of the story?</read:prompt>
          <read:options>
            <read:optionId>opt-3-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>The value of lifelong learning.</read:content>
          </read:options>
        </read:questions>
      </read:getReadingComprehensionQuizResponse>
    `;
  }

  function versionedQuizResponse(version: number = 1): string {
    return `
      <read:getReadingComprehensionQuizResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:readingId>reading-1</read:readingId>
        <read:available>true</read:available>
        <read:questions>
          <read:questionId>q-1</read:questionId>
          <read:ordinal>1</read:ordinal>
          <read:questionType>FACTUAL</read:questionType>
          <read:prompt>What did the main character do?</read:prompt>
          <read:options>
            <read:optionId>opt-1-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>He walked to the library.</read:content>
          </read:options>
          <read:options>
            <read:optionId>opt-1-2</read:optionId>
            <read:ordinal>2</read:ordinal>
            <read:content>He stayed home.</read:content>
          </read:options>
        </read:questions>
        <read:questions>
          <read:questionId>q-2</read:questionId>
          <read:ordinal>2</read:ordinal>
          <read:questionType>INFERENCE</read:questionType>
          <read:prompt>Why was the character excited?</read:prompt>
          <read:options>
            <read:optionId>opt-2-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>Because it was a sunny day.</read:content>
          </read:options>
        </read:questions>
        <read:questions>
          <read:questionId>q-3</read:questionId>
          <read:ordinal>3</read:ordinal>
          <read:questionType>MAIN_IDEA</read:questionType>
          <read:prompt>What is the central theme of the story?</read:prompt>
          <read:options>
            <read:optionId>opt-3-1</read:optionId>
            <read:ordinal>1</read:ordinal>
            <read:content>The value of lifelong learning.</read:content>
          </read:options>
        </read:questions>
        <read:selectionVersion>${version}</read:selectionVersion>
      </read:getReadingComprehensionQuizResponse>
    `;
  }

  function submitAttemptResponse(): string {
    return `
      <read:submitComprehensionAttemptResponse xmlns:read="http://soap.com/english-reading/readings">
        <read:attempt>
          <read:attemptId>att-1</read:attemptId>
          <read:readingId>reading-1</read:readingId>
          <read:submissionId>sub-uuid-1</read:submissionId>
          <read:scorePercentage>66.67</read:scorePercentage>
          <read:correctAnswersCount>2</read:correctAnswersCount>
          <read:totalQuestionsCount>3</read:totalQuestionsCount>
          <read:submittedAt>2026-09-12T10:00:00Z</read:submittedAt>
          <read:questions>
            <read:questionId>q-1</read:questionId>
            <read:ordinal>1</read:ordinal>
            <read:questionType>FACTUAL</read:questionType>
            <read:prompt>What did the main character do?</read:prompt>
            <read:selectedOptionId>opt-1-1</read:selectedOptionId>
            <read:correctOptionId>opt-1-1</read:correctOptionId>
            <read:isCorrect>true</read:isCorrect>
            <read:explanation>The text clearly states he walked to the library.</read:explanation>
            <read:options>
              <read:optionId>opt-1-1</read:optionId>
              <read:ordinal>1</read:ordinal>
              <read:content>He walked to the library.</read:content>
            </read:options>
            <read:options>
              <read:optionId>opt-1-2</read:optionId>
              <read:ordinal>2</read:ordinal>
              <read:content>He stayed home.</read:content>
            </read:options>
          </read:questions>
          <read:questions>
            <read:questionId>q-2</read:questionId>
            <read:ordinal>2</read:ordinal>
            <read:questionType>INFERENCE</read:questionType>
            <read:prompt>Why was the character excited?</read:prompt>
            <read:selectedOptionId>opt-2-1</read:selectedOptionId>
            <read:correctOptionId>opt-2-2</read:correctOptionId>
            <read:isCorrect>false</read:isCorrect>
            <read:explanation>The context implies his excitement came from the new book.</read:explanation>
            <read:options>
              <read:optionId>opt-2-1</read:optionId>
              <read:ordinal>1</read:ordinal>
              <read:content>Because it was a sunny day.</read:content>
            </read:options>
            <read:options>
              <read:optionId>opt-2-2</read:optionId>
              <read:ordinal>2</read:ordinal>
              <read:content>Because of the new book.</read:content>
            </read:options>
          </read:questions>
          <read:questions>
            <read:questionId>q-3</read:questionId>
            <read:ordinal>3</read:ordinal>
            <read:questionType>MAIN_IDEA</read:questionType>
            <read:prompt>What is the central theme of the story?</read:prompt>
            <read:selectedOptionId>opt-3-1</read:selectedOptionId>
            <read:correctOptionId>opt-3-1</read:correctOptionId>
            <read:isCorrect>true</read:isCorrect>
            <read:explanation>The entire passage discusses lifelong learning.</read:explanation>
            <read:options>
              <read:optionId>opt-3-1</read:optionId>
              <read:ordinal>1</read:ordinal>
              <read:content>The value of lifelong learning.</read:content>
            </read:options>
          </read:questions>
        </read:attempt>
      </read:submitComprehensionAttemptResponse>
    `;
  }
});
