import { DocumentFailureCode, UploadErrorPhase } from '../models/document.models';
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

const phaseMessages: Record<UploadErrorPhase, string> = {
  HASH_FAILED: 'No pudimos preparar el archivo para la subida. Inténtalo nuevamente.',
  CREATE_INTENT_FAILED: 'No pudimos iniciar la carga del documento. Comprueba tu conexión e inténtalo nuevamente.',
  UPLOAD_FAILED: 'Error al subir el archivo al almacenamiento. Inténtalo nuevamente.',
  PRESIGN_EXPIRED: 'La autorización de subida ha expirado. Por favor, reintenta la subida.',
  CONFIRM_FAILED: 'No pudimos confirmar la subida del documento. Puedes reintentar la confirmación.',
  PROCESSING_FAILED: 'El procesamiento del libro falló. Inténtalo nuevamente.',
};

export function documentFailureMessage(code: DocumentFailureCode | null): string {
  return code ? messages[code] : messages.IMPORT_FAILURE;
}

export function uploadPhaseErrorMessage(phase: UploadErrorPhase | null): string {
  return phase ? phaseMessages[phase] : messages.IMPORT_FAILURE;
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

export function confirmErrorMessage(response: HttpErrorResponse): string {
  const error = response.error as { code?: unknown; message?: unknown } | null;
  const code = error?.code;
  if (response.status === 409 && code === 'DOCUMENT_ALREADY_IMPORTED') {
    return 'Este libro ya está en tu biblioteca. Ya importaste este archivo o todavía se está procesando.';
  }
  if (code === 'UPLOAD_INTEGRITY_MISMATCH' || response.status === 422) {
    return 'El archivo subido no superó la verificación de integridad. Inténtalo nuevamente.';
  }
  if (code === 'UPLOAD_ABORTED') {
    return 'La subida del documento fue cancelada o abortada. Inténtalo nuevamente.';
  }
  if (code === 'UPLOAD_EXPIRED' || (response.status === 400 && code === 'UPLOAD_EXPIRED')) {
    return 'La autorización de subida ha expirado. Por favor, selecciona el archivo nuevamente.';
  }
  if (code === 'UPLOAD_NOT_COMPLETED' || (response.status === 409 && code === 'UPLOAD_NOT_COMPLETED')) {
    return 'La subida del archivo no se completó en el almacenamiento. Puedes reintentar la subida.';
  }
  return 'No pudimos confirmar la subida del documento. Puedes reintentar la confirmación.';
}

export function isConfirmRetryableError(response: HttpErrorResponse): boolean {
  const code = (response.error as { code?: unknown } | null)?.code;
  if (
    code === 'DOCUMENT_ALREADY_IMPORTED' ||
    code === 'UPLOAD_INTEGRITY_MISMATCH' ||
    code === 'UPLOAD_ABORTED' ||
    code === 'UPLOAD_EXPIRED' ||
    code === 'UPLOAD_NOT_COMPLETED' ||
    response.status === 422 ||
    (response.status === 409 &&
      (code === 'DOCUMENT_ALREADY_IMPORTED' ||
        code === 'UPLOAD_NOT_COMPLETED' ||
        code === 'UPLOAD_ABORTED'))
  ) {
    return false;
  }
  return true;
}

export function isUploadNotCompletedError(response: HttpErrorResponse): boolean {
  const code = (response.error as { code?: unknown } | null)?.code;
  return code === 'UPLOAD_NOT_COMPLETED' || (response.status === 409 && code === 'UPLOAD_NOT_COMPLETED');
}
