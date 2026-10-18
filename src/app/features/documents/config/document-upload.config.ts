import { InjectionToken } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface DocumentUploadConfig {
  /**
   * Feature flag controlling whether document imports use direct S3 upload
   * instead of legacy multipart upload to the application server.
   *
   * DEFAULT: false in development (legacy multipart upload remains active until backend worker is deployed)
   * ENABLED: true in production build via environment replacement
   */
  documentDirectUploadEnabled: boolean;
}

export const DEFAULT_DOCUMENT_UPLOAD_CONFIG: DocumentUploadConfig = {
  documentDirectUploadEnabled: environment.documentDirectUploadEnabled,
};

export const DOCUMENT_UPLOAD_CONFIG = new InjectionToken<DocumentUploadConfig>(
  'DOCUMENT_UPLOAD_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEFAULT_DOCUMENT_UPLOAD_CONFIG,
  }
);
