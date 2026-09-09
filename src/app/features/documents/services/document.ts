import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, takeUntil, takeWhile, throwError, timer } from 'rxjs';
import { Auth } from '../../auth/services/auth';
import { DocumentImportAccepted, DocumentProgress, DocumentStructure, DocumentUnit, ImportedDocument, ImportedDocumentPage, UpdateDocumentProgressRequest } from '../models/document.models';
import { ReaderToken } from '../../reader/models/reader.models';

interface DocumentUnitRestResponse extends Omit<DocumentUnit, 'tokens'> {
  tokens: DocumentTokenRestResponse[];
}

interface DocumentTokenRestResponse {
  value: string;
  normalizedValue: string | null;
  type: ReaderToken['type'];
  vocabularyStatus: ReaderToken['status'];
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly baseUrl = '/api/v1/documents';

  upload(file: File, languageOverride?: 'en'): Observable<DocumentImportAccepted> {
    const form = new FormData();
    form.append('file', file);
    if (languageOverride) form.append('languageOverride', languageOverride);
    return this.http.post<DocumentImportAccepted>(this.baseUrl, form, { headers: this.authHeaders() });
  }

  getDocument(documentId: string): Observable<ImportedDocument> {
    return this.http.get<ImportedDocument>(`${this.baseUrl}/${documentId}`, { headers: this.authHeaders() });
  }

  pollUntilTerminal(documentId: string, timeoutMs = 120_000): Observable<ImportedDocument> {
    return timer(0, 1500).pipe(
      switchMap(() => this.getDocument(documentId)),
      takeWhile((document) => document.status === 'PROCESSING', true),
      takeUntil(timer(timeoutMs).pipe(switchMap(() => throwError(() => new Error('DOCUMENT_POLL_TIMEOUT')))))
    );
  }

  list(page = 0, size = 20): Observable<ImportedDocumentPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ImportedDocumentPage>(this.baseUrl, { headers: this.authHeaders(), params });
  }

  getStructure(documentId: string): Observable<DocumentStructure> {
    return this.http.get<DocumentStructure>(`${this.baseUrl}/${documentId}/structure`, { headers: this.authHeaders() });
  }

  getUnit(documentId: string, unitId: string): Observable<DocumentUnit> {
    return this.http
      .get<DocumentUnitRestResponse>(`${this.baseUrl}/${documentId}/units/${unitId}`, {
        headers: this.authHeaders(),
      })
      .pipe(
        map((unit) => ({
          ...unit,
          tokens: unit.tokens.map(
            ({ vocabularyStatus, ...token }): ReaderToken => ({
              ...token,
              status: vocabularyStatus,
            })
          ),
        }))
      );
  }

  getProgress(documentId: string): Observable<DocumentProgress> {
    return this.http.get<DocumentProgress>(`${this.baseUrl}/${documentId}/progress`, { headers: this.authHeaders() });
  }

  updateProgress(documentId: string, request: UpdateDocumentProgressRequest): Observable<DocumentProgress> {
    return this.http.put<DocumentProgress>(`${this.baseUrl}/${documentId}/progress`, request, { headers: this.authHeaders() });
  }

  getCover(documentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${documentId}/cover`, { headers: this.authHeaders(), responseType: 'blob' });
  }

  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${documentId}`, { headers: this.authHeaders() });
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.accessToken();
    if (!token) throw new Error('Authentication token is missing');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
