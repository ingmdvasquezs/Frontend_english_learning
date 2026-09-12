import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import {
  ReaderData,
  ReaderToken,
  UpdateReadingProgressRequest,
  CompleteReadingResult,
  QuestionType,
  ComprehensionQuizOption,
  ComprehensionQuizQuestion,
  ComprehensionQuiz,
  SubmitComprehensionAttemptRequest,
  ComprehensionQuestionResultOption,
  ComprehensionQuestionResult,
  ComprehensionAttemptResult,
} from '../models/reader.models';
import { parseReadingProgressStatus } from '../../../shared/models/reading-progress-status';
import { escapeXml } from '../../../shared/utils/xml-utils';

@Injectable({
  providedIn: 'root',
})
export class ReaderService {
  private readonly http = inject(HttpClient);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';
  private readonly soapNamespace =
    'http://schemas.xmlsoap.org/soap/envelope/';

  getReaderData(readingId: string) {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:getReadingReaderDataRequest>
            <read:readingId>${escapeXml(readingId)}</read:readingId>
          </read:getReadingReaderDataRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.postSoap(body);
  }

  setVocabularyStatus(
    word: string,
    language: string,
    status: VocabularyStatus
  ) {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:setVocabularyStatusRequest>
            <read:word>${escapeXml(word)}</read:word>
            <read:language>${escapeXml(language)}</read:language>
            <read:status>${status}</read:status>
          </read:setVocabularyStatusRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.postSoap(body);
  }

  completeReading(readingId: string) {
    const body = `
      <soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:completeReadingRequest>
            <read:readingId>${escapeXml(readingId)}</read:readingId>
          </read:completeReadingRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.postSoap(body);
  }

  updateReadingProgress(request: UpdateReadingProgressRequest) {
    const body = `
      <soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:updateReadingProgressRequest>
            <read:readingId>${escapeXml(request.readingId)}</read:readingId>
            <read:progressStatus>${request.progressStatus}</read:progressStatus>
            <read:currentPartOrdinal>${request.currentPartOrdinal}</read:currentPartOrdinal>
            <read:paginationVersion>${request.paginationVersion}</read:paginationVersion>
          </read:updateReadingProgressRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.postSoap(body);
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
      currentPartOrdinal: this.getOptionalInteger(xml, 'currentPartOrdinal'),
      paginationVersion: this.getOptionalInteger(xml, 'paginationVersion'),
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

  getReadingComprehensionQuiz(readingId: string): Observable<ComprehensionQuiz> {
    const body = `
      <soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:getReadingComprehensionQuizRequest>
            <read:readingId>${escapeXml(readingId)}</read:readingId>
          </read:getReadingComprehensionQuizRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.postSoap(body).pipe(
      map((response) => this.parseReadingComprehensionQuiz(response))
    );
  }

  submitComprehensionAttempt(
    request: SubmitComprehensionAttemptRequest
  ): Observable<ComprehensionAttemptResult> {
    const answersXml = request.answers
      .map(
        (a) => `
          <read:answers>
            <read:questionId>${escapeXml(a.questionId)}</read:questionId>
            <read:selectedOptionId>${escapeXml(a.selectedOptionId)}</read:selectedOptionId>
          </read:answers>
        `
      )
      .join('');

    const body = `
      <soapenv:Envelope xmlns:soapenv="${this.soapNamespace}" xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:submitComprehensionAttemptRequest>
            <read:readingId>${escapeXml(request.readingId)}</read:readingId>
            <read:submissionId>${escapeXml(request.submissionId)}</read:submissionId>
            ${answersXml}
          </read:submitComprehensionAttemptRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.postSoap(body).pipe(
      map((response) => this.parseComprehensionAttemptResult(response))
    );
  }

  parseReadingComprehensionQuiz(responseXml: string): ComprehensionQuiz {
    const xml = this.parseXml(responseXml);
    const readingId = this.getRequiredValue(xml, 'readingId');
    const available = this.getRequiredValue(xml, 'available') === 'true';

    const questionElements = this.getDirectElements(xml, 'questions');

    const questions: ComprehensionQuizQuestion[] = questionElements
      .map((element) => {
        const optionElements = this.getDirectElements(element, 'options');

        const options: ComprehensionQuizOption[] = optionElements
          .map((optEl) => ({
            optionId: this.getRequiredValue(optEl, 'optionId'),
            ordinal: this.getRequiredInteger(optEl, 'ordinal'),
            content: this.getRequiredValue(optEl, 'content'),
          }))
          .sort((a, b) => a.ordinal - b.ordinal);

        return {
          questionId: this.getRequiredValue(element, 'questionId'),
          ordinal: this.getRequiredInteger(element, 'ordinal'),
          questionType: this.getQuestionType(element),
          prompt: this.getRequiredValue(element, 'prompt'),
          options,
        };
      })
      .sort((a, b) => a.ordinal - b.ordinal);

    return {
      readingId,
      available,
      questions,
    };
  }

  parseComprehensionAttemptResult(
    responseXml: string
  ): ComprehensionAttemptResult {
    const xml = this.parseXml(responseXml);
    const attemptEl =
      xml.getElementsByTagNameNS(this.namespace, 'attempt')[0] ??
      Array.from(xml.getElementsByTagName('*')).find(
        (el) => el.localName === 'attempt'
      );
    if (!attemptEl) {
      throw new Error('Invalid SOAP response: missing attempt');
    }

    const attemptId = this.getRequiredValue(attemptEl, 'attemptId');
    const readingId = this.getRequiredValue(attemptEl, 'readingId');
    const submissionId = this.getRequiredValue(attemptEl, 'submissionId');
    const scorePercentage = Number(
      this.getRequiredValue(attemptEl, 'scorePercentage')
    );
    const correctAnswersCount = this.getRequiredInteger(
      attemptEl,
      'correctAnswersCount'
    );
    const totalQuestionsCount = this.getRequiredInteger(
      attemptEl,
      'totalQuestionsCount'
    );
    const submittedAt = this.getRequiredValue(attemptEl, 'submittedAt');

    const questionElements = this.getDirectElements(attemptEl, 'questions');

    const questions: ComprehensionQuestionResult[] = questionElements
      .map((element) => {
        const optionElements = this.getDirectElements(element, 'options');

        const options: ComprehensionQuestionResultOption[] = optionElements
          .map((optEl) => ({
            optionId: this.getRequiredValue(optEl, 'optionId'),
            ordinal: this.getRequiredInteger(optEl, 'ordinal'),
            content: this.getRequiredValue(optEl, 'content'),
          }))
          .sort((a, b) => a.ordinal - b.ordinal);

        return {
          questionId: this.getRequiredValue(element, 'questionId'),
          ordinal: this.getRequiredInteger(element, 'ordinal'),
          questionType: this.getQuestionType(element),
          prompt: this.getRequiredValue(element, 'prompt'),
          selectedOptionId: this.getRequiredValue(element, 'selectedOptionId'),
          correctOptionId: this.getRequiredValue(element, 'correctOptionId'),
          isCorrect: this.getRequiredValue(element, 'isCorrect') === 'true',
          explanation: this.getRequiredValue(element, 'explanation'),
          options,
        };
      })
      .sort((a, b) => a.ordinal - b.ordinal);

    return {
      attemptId,
      readingId,
      submissionId,
      scorePercentage,
      correctAnswersCount,
      totalQuestionsCount,
      submittedAt,
      questions,
    };
  }

  private getQuestionType(element: Element): QuestionType {
    const value = this.getRequiredValue(element, 'questionType');
    if (!['FACTUAL', 'INFERENCE', 'MAIN_IDEA'].includes(value)) {
      throw new Error('Invalid SOAP response: invalid question type');
    }
    return value as QuestionType;
  }

  private getDirectElements(parent: Element | Document, name: string): Element[] {
    const nsMatches = Array.from(parent.getElementsByTagNameNS(this.namespace, name));
    if (nsMatches.length > 0) return nsMatches;
    return Array.from(parent.getElementsByTagName('*')).filter(
      (el) => el.localName === name
    );
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

  private postSoap(body: string) {
    return this.http
      .post(this.soapUrl, body, {
        headers: new HttpHeaders({
          'Content-Type': 'text/xml',
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

  private getOptionalInteger(
    parent: Element | Document,
    name: string
  ): number | null {
    const rawValue = this.getOptionalValue(parent, name);
    if (rawValue === null || rawValue.trim() === '') return null;
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Invalid SOAP response: invalid ${name}`);
    }
    return value;
  }

  private getRequiredInteger(parent: Element | Document, name: string): number {
    const value = this.getOptionalInteger(parent, name);
    if (value === null) {
      throw new Error(`Invalid SOAP response: missing ${name}`);
    }
    return value;
  }
}
