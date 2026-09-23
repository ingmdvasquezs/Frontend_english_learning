import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { VocabularyStatus } from '../../../shared/models/vocabulary-status';
import { escapeXml } from '../../../shared/utils/xml-utils';
import {
  PreparedReviewEntry,
  PreparedReviewSession,
  RatingOption,
  ReviewAssessment,
  ReviewBatchSize,
  ReviewRating,
  ReviewResult,
  SrsState,
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

  readonly cachedPreparation = signal<PreparedReviewSession | null>(null);

  invalidatePreparationCache(): void {
    this.cachedPreparation.set(null);
  }

  listUserVocabulary(
    page = 0,
    size = 10,
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

  setVocabularyStatus(
    word: string,
    language: string,
    status: VocabularyStatus
  ): Observable<string> {
    if (status === 'KNOWN') {
      throw new Error('VocabularyStatus.KNOWN can only be established from Reader');
    }

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

    return this.http
      .post(this.soapUrl, body, {
        headers: this.soapHeaders(),
        responseType: 'text',
      })
      .pipe(
        map((response) => {
          this.checkForSoapFault(
            new DOMParser().parseFromString(response, 'text/xml')
          );
          return response;
        })
      );
  }

  prepareVocabularyReview(size: ReviewBatchSize | number = 15): Observable<PreparedReviewSession> {
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:prepareVocabularyReviewRequest>
            <read:size>${size}</read:size>
          </read:prepareVocabularyReviewRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http
      .post(this.soapUrl, body, {
        headers: this.soapHeaders(),
        responseType: 'text',
      })
      .pipe(
        map((response) => this.parsePreparedReviewSession(response)),
        tap((session) => this.cachedPreparation.set(session))
      );
  }

  recordVocabularyReview(
    wordId: string,
    ratingOrAssessment: ReviewRating | ReviewAssessment
  ): Observable<ReviewResult> {
    const isRating = ['AGAIN', 'HARD', 'GOOD', 'EASY'].includes(ratingOrAssessment);
    const tag = isRating ? 'read:rating' : 'read:assessment';
    const body = `
      <soapenv:Envelope
          xmlns:soapenv="${this.soapNamespace}"
          xmlns:read="${this.namespace}">
        <soapenv:Header/>
        <soapenv:Body>
          <read:recordVocabularyReviewRequest>
            <read:wordId>${escapeXml(wordId)}</read:wordId>
            <${tag}>${ratingOrAssessment}</${tag}>
          </read:recordVocabularyReviewRequest>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    return this.http
      .post(this.soapUrl, body, {
        headers: this.soapHeaders(),
        responseType: 'text',
      })
      .pipe(
        map((response) => this.parseRecordedReviewResult(response)),
        tap(() => this.invalidatePreparationCache())
      );
  }

  parsePreparedReviewSession(responseXml: string): PreparedReviewSession {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    this.checkForSoapFault(xml);

    const dueCount = this.parseInteger(this.getOptionalValue(xml, 'dueCount'), 0);
    const totalReviewableCount = this.parseInteger(
      this.getOptionalValue(xml, 'totalReviewableCount'),
      0
    );

    const dailyLimitRaw = this.getOptionalValue(xml, 'dailyLimit');
    const dailyLimit = dailyLimitRaw !== null ? this.parseInteger(dailyLimitRaw, 15) : undefined;

    const dailyBaseCompletedRaw = this.getOptionalValue(xml, 'dailyBaseCompleted');
    const dailyBaseCompleted =
      dailyBaseCompletedRaw !== null ? this.parseInteger(dailyBaseCompletedRaw, 0) : undefined;

    const dailyBaseRemainingRaw = this.getOptionalValue(xml, 'dailyBaseRemaining');
    const dailyBaseRemaining =
      dailyBaseRemainingRaw !== null ? this.parseInteger(dailyBaseRemainingRaw, 0) : undefined;

    const pendingLearningCountRaw = this.getOptionalValue(xml, 'pendingLearningCount');
    const pendingLearningCount =
      pendingLearningCountRaw !== null ? this.parseInteger(pendingLearningCountRaw, 0) : undefined;

    const dailyCompleteRaw = this.getOptionalValue(xml, 'dailyComplete');
    const dailyComplete = dailyCompleteRaw !== null ? dailyCompleteRaw === 'true' : undefined;

    const entryNodes = this.getReviewItemElements(xml, 'entries');
    const entries: PreparedReviewEntry[] = entryNodes.map((element) =>
      this.parseReviewItem(element)
    );

    const learnAheadNodes = this.getReviewItemElements(xml, 'learnAheadEntries');
    const learnAheadEntries: PreparedReviewEntry[] = learnAheadNodes.map((element) =>
      this.parseReviewItem(element)
    );

    return {
      dueCount,
      totalReviewableCount,
      dailyLimit,
      dailyBaseCompleted,
      dailyBaseRemaining,
      pendingLearningCount,
      dailyComplete,
      entries,
      learnAheadEntries,
    };
  }

  private getReviewItemElements(
    xml: Document,
    tagName: 'entries' | 'learnAheadEntries'
  ): Element[] {
    const nsNodes = xml.getElementsByTagNameNS(this.namespace, tagName);
    if (nsNodes.length > 0) {
      return Array.from(nsNodes);
    }
    return Array.from(xml.getElementsByTagName('*')).filter(
      (element) => element.localName === tagName
    );
  }

  private parseReviewItem(element: Element): PreparedReviewEntry {
    const rawStatus = this.getRequiredValue(element, 'status');
    if (!this.isValidStatus(rawStatus)) {
      throw new Error(`Invalid SOAP response: invalid status "${rawStatus}"`);
    }

    const srsStateRaw = this.getOptionalValue(element, 'srsState');
    const srsState =
      srsStateRaw && ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'].includes(srsStateRaw)
        ? (srsStateRaw as SrsState)
        : null;

    const ratingOptionNodes =
      element.getElementsByTagNameNS(this.namespace, 'ratingOptions').length > 0
        ? Array.from(element.getElementsByTagNameNS(this.namespace, 'ratingOptions'))
        : Array.from(element.getElementsByTagName('*')).filter(
            (el) => el.localName === 'ratingOptions'
          );

    const ratingOptions: RatingOption[] = ratingOptionNodes.map((optEl) => {
      const rating = this.getRequiredValue(optEl, 'rating') as ReviewRating;
      const nextReviewAt = this.getOptionalValue(optEl, 'nextReviewAt') ?? undefined;
      const intervalSeconds = this.parseInteger(
        this.getRequiredValue(optEl, 'intervalSeconds'),
        0
      );
      return { rating, nextReviewAt, intervalSeconds };
    });

    const pendingQueueSequenceRaw = this.getDirectChildValue(element, 'pendingQueueSequence');
    const pendingQueueSequence =
      pendingQueueSequenceRaw !== null ? this.parseInteger(pendingQueueSequenceRaw, 0) : null;

    const baseOrderRaw = this.getDirectChildValue(element, 'baseOrder');
    const baseOrder =
      baseOrderRaw !== null ? this.parseInteger(baseOrderRaw, 0) : null;

    const nextReviewAt = this.getDirectChildValue(element, 'nextReviewAt');

    return {
      wordId: this.getRequiredValue(element, 'wordId'),
      word: this.getRequiredValue(element, 'word'),
      language: this.getRequiredValue(element, 'language'),
      status: rawStatus as VocabularyStatus,
      srsState,
      ratingOptions,
      pendingQueueSequence,
      baseOrder,
      nextReviewAt,
    };
  }

  parseRecordedReviewResult(responseXml: string): ReviewResult {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    this.checkForSoapFault(xml);

    const entryEl =
      xml.getElementsByTagNameNS(this.namespace, 'entry')[0] ??
      Array.from(xml.getElementsByTagName('*')).find((el) => el.localName === 'entry') ??
      xml;

    const rawStatus = this.getRequiredValue(entryEl, 'status');
    if (!this.isValidStatus(rawStatus)) {
      throw new Error(`Invalid SOAP response: invalid status "${rawStatus}"`);
    }

    const srsStateRaw = this.getOptionalValue(entryEl, 'srsState');
    const srsState =
      srsStateRaw && ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'].includes(srsStateRaw)
        ? (srsStateRaw as SrsState)
        : null;

    const nextReviewAt = this.getOptionalValue(entryEl, 'nextReviewAt');
    const intervalSecondsRaw = this.getOptionalValue(entryEl, 'intervalSeconds');
    const intervalSeconds =
      intervalSecondsRaw !== null ? this.parseInteger(intervalSecondsRaw, 0) : null;
    const stabilityRaw = this.getOptionalValue(entryEl, 'stability');
    const stability = stabilityRaw !== null ? parseFloat(stabilityRaw) : null;
    const difficultyRaw = this.getOptionalValue(entryEl, 'difficulty');
    const difficulty = difficultyRaw !== null ? parseFloat(difficultyRaw) : null;

    const pendingQueueSequenceRaw = this.getOptionalValue(entryEl, 'pendingQueueSequence');
    const pendingQueueSequence =
      pendingQueueSequenceRaw !== null ? this.parseInteger(pendingQueueSequenceRaw, 0) : null;

    const baseOrderRaw = this.getOptionalValue(entryEl, 'baseOrder');
    const baseOrder =
      baseOrderRaw !== null ? this.parseInteger(baseOrderRaw, 0) : null;

    const ratingOptionNodes =
      entryEl.getElementsByTagNameNS(this.namespace, 'ratingOptions').length > 0
        ? Array.from(entryEl.getElementsByTagNameNS(this.namespace, 'ratingOptions'))
        : Array.from(entryEl.getElementsByTagName('*')).filter(
            (el) => el.localName === 'ratingOptions'
          );

    const ratingOptions: RatingOption[] = ratingOptionNodes.map((optEl) => {
      const rating = this.getRequiredValue(optEl, 'rating') as ReviewRating;
      const optNextReviewAt = this.getOptionalValue(optEl, 'nextReviewAt') ?? undefined;
      const optIntervalSeconds = this.parseInteger(
        this.getRequiredValue(optEl, 'intervalSeconds'),
        0
      );
      return { rating, nextReviewAt: optNextReviewAt, intervalSeconds: optIntervalSeconds };
    });

    return {
      wordId: this.getRequiredValue(entryEl, 'wordId'),
      status: rawStatus as VocabularyStatus,
      srsState,
      nextReviewAt,
      intervalSeconds,
      stability,
      difficulty,
      ratingOptions,
      pendingQueueSequence,
      baseOrder,
    };
  }

  private checkForSoapFault(xml: Document): void {
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
  }

  parseUserVocabulary(responseXml: string): UserVocabularyPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    this.checkForSoapFault(xml);

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

  private getDirectChildValue(parent: Element, name: string): string | null {
    const child = Array.from(parent.children).find(
      (el) =>
        el.localName === name ||
        el.nodeName === name ||
        el.nodeName.endsWith(':' + name)
    );
    return child?.textContent?.trim() ?? null;
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
