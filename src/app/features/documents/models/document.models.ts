import { ReaderToken } from '../../reader/models/reader.models';

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';
export type DocumentProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type DocumentFormat = 'EPUB' | 'PDF';
export type DocumentFailureCode =
  | 'INVALID_EPUB' | 'UNSUPPORTED_DRM' | 'LANGUAGE_REQUIRED'
  | 'UNSUPPORTED_LANGUAGE' | 'FILE_TOO_LARGE' | 'SECURITY_LIMIT_EXCEEDED'
  | 'STORAGE_FAILURE' | 'IMPORT_FAILURE' | 'INVALID_PDF'
  | 'PDF_PASSWORD_PROTECTED' | 'PDF_SCANNED_NOT_SUPPORTED';

export interface ImportedDocument {
  documentId: string;
  title: string;
  author: string | null;
  language: string | null;
  format: DocumentFormat;
  status: DocumentStatus;
  failureReason: DocumentFailureCode | null;
  coverAvailable: boolean;
  coverUrl: string | null;
  progressStatus: DocumentProgressStatus;
  lastReadAt: string | null;
  createdAt: string;
}

export interface DocumentImportAccepted {
  documentId: string;
  status: 'PROCESSING';
}

export interface ImportedDocumentPage {
  content: ImportedDocument[];
  page: number;
  size: number;
  totalElements: number;
}

export interface DocumentSection {
  id: string;
  ordinal: number;
  title: string | null;
  firstUnitId: string | null;
  unitCount: number;
}

export interface DocumentStructure {
  documentId: string;
  firstUnitId: string | null;
  sections: DocumentSection[];
  totalUnits: number;
}

export interface DocumentUnit {
  documentId: string;
  sectionId: string;
  sectionTitle: string | null;
  sectionOrdinal: number;
  totalSections: number;
  unitId: string;
  sectionUnitOrdinal: number;
  sectionUnitCount: number;
  globalOrdinal: number;
  totalUnits: number;
  tokens: ReaderToken[];
  previousUnitId: string | null;
  nextUnitId: string | null;
  progressStatus: DocumentProgressStatus;
}

export interface DocumentProgress {
  documentId: string;
  status: DocumentProgressStatus;
  currentUnitId: string | null;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface UpdateDocumentProgressRequest {
  currentUnitId: string;
  completed: boolean;
  expectedVersion: number;
}
