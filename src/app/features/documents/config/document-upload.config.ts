import { InjectionToken } from '@angular/core';

export interface DocumentUploadConfig {
  /**
   * Feature flag controlling whether document imports use direct S3 upload
   * instead of legacy multipart upload to the application server.
   *
   * DEFAULT: false (legacy multipart upload remains active until backend worker is deployed)
   */
  documentDirectUploadEnabled: boolean;
}

export const DEFAULT_DOCUMENT_UPLOAD_CONFIG: DocumentUploadConfig = {
  documentDirectUploadEnabled: false,
};

export const DOCUMENT_UPLOAD_CONFIG = new InjectionToken<DocumentUploadConfig>(
  'DOCUMENT_UPLOAD_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEFAULT_DOCUMENT_UPLOAD_CONFIG,
  }
);
