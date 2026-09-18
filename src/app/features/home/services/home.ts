import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  PlatformReadingRecommendationsPage,
  RecommendedPlatformReading,
  EditorialLevel,
  ReadingCollection,
  CollectionReadingsPage,
  ContinueReadingPage,
  ContinueReadingItem,
  ReadingOrigin,
  DiscoveryRegionOverview,
  DiscoveryRegionDetails,
  DiscoveryCountrySummary,
  DiscoveryHeroImage,
  DiscoveryTopicSummary,
  BrowsePlatformReadingsFilters,
  BrowsePlatformReadingsPage,
} from '../models/home.models';
import { parseReadingProgressStatus } from '../../../shared/models/reading-progress-status';
import { escapeXml } from '../../../shared/utils/xml-utils';
import { parseRecommendationReasonCode } from '../utils/recommendation-reason';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly http = inject(HttpClient);

  private readonly soapUrl = '/ws';
  private readonly namespace = 'http://soap.com/english-reading/readings';

  recommendPlatformReadings(page = 0, size = 12) {
    return this.postSoap(`
      <read:recommendPlatformReadingsRequest>
        <read:page>${page}</read:page>
        <read:size>${size}</read:size>
      </read:recommendPlatformReadingsRequest>
    `);
  }

  listCollections() {
    return this.postSoap('<read:listCollectionsRequest/>');
  }

  listContinueReading(page = 0, size = 10) {
    return this.postSoap(`
      <read:listContinueReadingRequest>
        <read:page>${page}</read:page>
        <read:size>${size}</read:size>
      </read:listContinueReadingRequest>
    `);
  }

  parseContinueReading(responseXml: string): ContinueReadingPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readings: ContinueReadingItem[] = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    ).map((element) => ({
      readingId: this.getRequiredValue(element, 'readingId'),
      title: this.getRequiredValue(element, 'title'),
      origin: this.getReadingOrigin(element),
      progressStatus: this.getRequiredProgressStatus(element),
      coverKey: this.getOptionalValue(element, 'coverKey'),
      editorialLevel: this.getOptionalEditorialLevel(element),
      category: this.getOptionalValue(element, 'category'),
      startedAt: this.getRequiredValue(element, 'startedAt'),
      description:
        this.getOptionalValue(element, 'shortDescription') ??
        this.getOptionalValue(element, 'description'),
      progressPercentage: this.getOptionalNumber(element, 'progressPercentage'),
    }));
    return {
      page: this.getRequiredNumber(xml, 'page'),
      size: this.getRequiredNumber(xml, 'size'),
      totalElements: this.getRequiredNumber(xml, 'totalElements'),
      readings,
    };
  }

  listCollectionReadings(collectionKey: string, page = 0, size = 20) {
    return this.postSoap(`
      <read:listCollectionReadingsRequest>
        <read:collectionKey>${escapeXml(collectionKey)}</read:collectionKey>
        <read:page>${page}</read:page>
        <read:size>${size}</read:size>
      </read:listCollectionReadingsRequest>
    `);
  }

  parseCollections(responseXml: string): ReadingCollection[] {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    return Array.from(xml.getElementsByTagNameNS(this.namespace, 'collections'))
      .map((element) => ({
        key: this.getRequiredValue(element, 'key'),
        displayName: this.getRequiredValue(element, 'displayName'),
        description: this.getRequiredValue(element, 'description'),
        displayOrder: this.getRequiredNumber(element, 'displayOrder'),
        coverKey: this.getOptionalValue(element, 'coverKey'),
        readingCount: this.getOptionalNumber(element, 'readingCount'),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  parseCollectionReadings(responseXml: string): CollectionReadingsPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readings: RecommendedPlatformReading[] = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    ).map((element) => this.parseRecommendedReading(element));
    return {
      page: this.getRequiredNumber(xml, 'page'),
      size: this.getRequiredNumber(xml, 'size'),
      totalElements: this.getRequiredNumber(xml, 'totalElements'),
      readings,
    };
  }

  getDiscoveryRegionOverview(regionKey = 'latin-america') {
    return this.postSoap(`
      <read:getDiscoveryRegionOverviewRequest>
        <read:regionKey>${escapeXml(regionKey)}</read:regionKey>
      </read:getDiscoveryRegionOverviewRequest>
    `);
  }

  parseDiscoveryRegionOverview(responseXml: string): DiscoveryRegionOverview {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const regionElement = xml.getElementsByTagNameNS(this.namespace, 'region')[0];
    if (!regionElement) {
      throw new Error('Invalid SOAP response: missing region');
    }

    const region: DiscoveryRegionDetails = {
      key: this.getRequiredValue(regionElement, 'key'),
      displayName: this.getRequiredValue(regionElement, 'displayName'),
      subtitle: this.getOptionalValue(regionElement, 'subtitle'),
    };

    const countryElements = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'countries')
    );

    const countries: DiscoveryCountrySummary[] = countryElements.map((countryEl) => {
      const heroImageElements = Array.from(
        countryEl.getElementsByTagNameNS(this.namespace, 'heroImages')
      );
      const heroImages: DiscoveryHeroImage[] = heroImageElements.map((imgEl) => ({
        assetKey: this.getRequiredValue(imgEl, 'assetKey'),
        location: this.getOptionalValue(imgEl, 'location'),
        alt: this.getOptionalValue(imgEl, 'alt'),
        displayOrder: this.getRequiredNumber(imgEl, 'displayOrder'),
      })).sort((a, b) => a.displayOrder - b.displayOrder);

      const topicElements = Array.from(
        countryEl.getElementsByTagNameNS(this.namespace, 'topics')
      );
      const topics: DiscoveryTopicSummary[] = topicElements.map((topicEl) => ({
        key: this.getRequiredValue(topicEl, 'key'),
        displayName: this.getRequiredValue(topicEl, 'displayName'),
        displayOrder: this.getRequiredNumber(topicEl, 'displayOrder'),
        readingCount: this.getRequiredNumber(topicEl, 'readingCount'),
      })).sort((a, b) => a.displayOrder - b.displayOrder);

      return {
        countryCode: this.getRequiredValue(countryEl, 'countryCode'),
        displayName: this.getDirectChildValue(countryEl, 'displayName') ?? this.getRequiredValue(countryEl, 'displayName'),
        tagline: this.getRequiredValue(countryEl, 'tagline'),
        description: this.getRequiredValue(countryEl, 'description'),
        displayOrder: this.getRequiredNumber(countryEl, 'displayOrder'),
        readingCount: this.getRequiredNumber(countryEl, 'readingCount'),
        heroImages,
        topics,
      };
    }).sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      region,
      countries,
    };
  }

  browsePlatformReadings(filters: BrowsePlatformReadingsFilters) {
    const filterElements = [
      filters.collectionKey
        ? `<read:collectionKey>${escapeXml(filters.collectionKey)}</read:collectionKey>`
        : '',
      filters.category
        ? `<read:category>${escapeXml(filters.category)}</read:category>`
        : '',
      filters.editorialLevel
        ? `<read:editorialLevel>${escapeXml(filters.editorialLevel)}</read:editorialLevel>`
        : '',
      filters.countryCode
        ? `<read:countryCode>${escapeXml(filters.countryCode)}</read:countryCode>`
        : '',
      filters.discoveryTopic
        ? `<read:discoveryTopic>${escapeXml(filters.discoveryTopic)}</read:discoveryTopic>`
        : '',
      `<read:page>${filters.page ?? 0}</read:page>`,
      `<read:size>${filters.size ?? 20}</read:size>`,
    ]
      .filter(Boolean)
      .join('');

    return this.postSoap(`
      <read:browsePlatformReadingsRequest>${filterElements}</read:browsePlatformReadingsRequest>
    `);
  }

  parseBrowsePlatformReadings(responseXml: string): BrowsePlatformReadingsPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readings: RecommendedPlatformReading[] = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    ).map((element) => this.parseRecommendedReading(element));
    return {
      page: this.getRequiredNumber(xml, 'page'),
      size: this.getRequiredNumber(xml, 'size'),
      totalElements: this.getRequiredNumber(xml, 'totalElements'),
      readings,
    };
  }

  private postSoap(payload: string) {
    const body = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:read="${this.namespace}">
        <soapenv:Header/><soapenv:Body>${payload}</soapenv:Body>
      </soapenv:Envelope>
    `;
    return this.http.post(this.soapUrl, body, {
      headers: new HttpHeaders({
        'Content-Type': 'text/xml',
      }),
      responseType: 'text',
    });
  }

  parseRecommendations(
    responseXml: string
  ): PlatformReadingRecommendationsPage {
    const xml = new DOMParser().parseFromString(responseXml, 'text/xml');
    const readingElements = Array.from(
      xml.getElementsByTagNameNS(this.namespace, 'readings')
    );

    const readings = readingElements.map((element) =>
      this.parseRecommendedReading(element)
    );

    return {
      page: this.getRequiredNumber(xml, 'page'),
      size: this.getRequiredNumber(xml, 'size'),
      totalElements: this.getRequiredNumber(xml, 'totalElements'),
      readings,
    };
  }

  parseRecommendedReading(element: Element): RecommendedPlatformReading {
    return {
      readingId: this.getRequiredValue(element, 'readingId'),
      title: this.getRequiredValue(element, 'title'),
      language: this.getRequiredValue(element, 'language'),
      editorialLevel: this.getEditorialLevel(element),
      category: this.getRequiredValue(element, 'category'),
      createdAt: this.getOptionalValue(element, 'createdAt'),
      uniqueWords: this.getRequiredNumber(element, 'uniqueWords'),
      knownWords: this.getRequiredNumber(element, 'knownWords'),
      learningWords: this.getRequiredNumber(element, 'learningWords'),
      explicitNewWords: this.getRequiredNumber(element, 'explicitNewWords'),
      ignoredWords: this.getRequiredNumber(element, 'ignoredWords'),
      unclassifiedWords: this.getRequiredNumber(element, 'unclassifiedWords'),
      vocabularyFitPercentage: this.getRequiredNumber(element, 'vocabularyFitPercentage'),
      classificationConfidencePercentage: this.getRequiredNumber(
        element,
        'classificationConfidencePercentage'
      ),
      progressStatus: parseReadingProgressStatus(
        this.getOptionalValue(element, 'progressStatus')
      ),
      coverKey: this.getOptionalValue(element, 'coverKey'),
      reasonCode: parseRecommendationReasonCode(
        this.getOptionalValue(element, 'reasonCode')
      ),
      description: this.getOptionalValue(element, 'shortDescription'),
      countryCode: this.getOptionalValue(element, 'countryCode') ?? undefined,
      discoveryTopic: this.getOptionalValue(element, 'discoveryTopic') ?? undefined,
    };
  }

  private getRequiredNumber(
    parent: Element | Document,
    name: string
  ): number {
    const rawValue = this.getRequiredValue(parent, name);
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid SOAP response: ${name} is not numeric`);
    }
    return value;
  }

  private getOptionalNumber(
    parent: Element | Document,
    name: string
  ): number | null {
    const rawValue = this.getOptionalValue(parent, name);
    if (rawValue === null || rawValue.trim() === '') {
      return null;
    }
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
  }

  private getEditorialLevel(element: Element): EditorialLevel {
    const value = this.getRequiredValue(element, 'editorialLevel');
    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value)) {
      throw new Error('Invalid SOAP response: invalid editorial level');
    }
    return value as EditorialLevel;
  }

  private getOptionalEditorialLevel(element: Element): EditorialLevel | null {
    const value = this.getOptionalValue(element, 'editorialLevel');
    if (value === null) return null;
    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value)) {
      throw new Error('Invalid SOAP response: invalid editorial level');
    }
    return value as EditorialLevel;
  }

  private getReadingOrigin(element: Element): ReadingOrigin {
    const value = this.getRequiredValue(element, 'origin');
    if (value !== 'USER' && value !== 'PLATFORM') {
      throw new Error('Invalid SOAP response: invalid reading origin');
    }
    return value;
  }

  private getRequiredProgressStatus(element: Element) {
    const status = parseReadingProgressStatus(
      this.getRequiredValue(element, 'progressStatus')
    );
    if (status === null) {
      throw new Error('Invalid SOAP response: invalid progress status');
    }
    return status;
  }

  private getRequiredValue(parent: Element | Document, name: string): string {
    const value = this.getOptionalValue(parent, name);
    if (value === null || value.trim() === '') {
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

  private getDirectChildValue(parent: Element, name: string): string | null {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const node = parent.childNodes[i];
      if (node.nodeType === 1) {
        const el = node as Element;
        if (el.localName === name || el.nodeName.endsWith(`:${name}`)) {
          const text = el.textContent?.trim();
          return text !== undefined && text !== '' ? text : null;
        }
      }
    }
    return null;
  }
}
