import { DocumentFailureCode } from '../models/document.models';
import { HttpErrorResponse } from '@angular/common/http';

const messages: Record<DocumentFailureCode, string> = {
  INVALID_EPUB: 'No pudimos leer este archivo como un EPUB válido.',
  UNSUPPORTED_DRM: 'Este libro tiene protección DRM y no puede importarse.',
  LANGUAGE_REQUIRED: 'No pudimos detectar el idioma del libro.',
  UNSUPPORTED_LANGUAGE: 'Por ahora, los libros importados deben estar en inglés.',
  FILE_TOO_LARGE: 'El archivo supera el tamaño permitido.',
  SECURITY_LIMIT_EXCEEDED: 'No pudimos importar este archivo porque excede los límites de seguridad permitidos.',
  STORAGE_FAILURE: 'No pudimos preparar el libro. Inténtalo nuevamente.',
  IMPORT_FAILURE: 'No pudimos preparar el libro. Inténtalo nuevamente.',
  INVALID_PDF: 'El archivo PDF no es válido o está dañado.',
  PDF_PASSWORD_PROTECTED: 'Los archivos PDF protegidos con contraseña todavía no son compatibles.',
  PDF_SCANNED_NOT_SUPPORTED: 'Este PDF parece estar compuesto por imágenes. La lectura de PDF escaneados todavía no está disponible.',
};

export function documentFailureMessage(code: DocumentFailureCode | null): string {
  return code ? messages[code] : messages.IMPORT_FAILURE;
}

export function isDocumentAlreadyImportedError(response: HttpErrorResponse): boolean {
  const error = response.error as { code?: unknown } | null;
  return response.status === 409 && error?.code === 'DOCUMENT_ALREADY_IMPORTED';
}

export function isDocumentProcessingError(response: HttpErrorResponse): boolean {
  const error = response.error as { code?: unknown } | null;
  return response.status === 409 && error?.code === 'DOCUMENT_PROCESSING';
}

export function isDocumentNotFoundError(response: HttpErrorResponse): boolean {
  const error = response.error as { code?: unknown } | null;
  return response.status === 404 && error?.code === 'DOCUMENT_NOT_FOUND';
}
