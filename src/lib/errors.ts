// Fachliche Fehler mit sicherer, deutscher Meldung. Interne Details werden nie an Benutzer ausgegeben.

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Wandelt jeden Fehler in ein sicheres Ergebnis für Server Actions um.
export function toActionError(error: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message, fieldErrors: error.details };
  }
  console.error('[autopass] unerwarteter Fehler', error);
  return { ok: false, error: 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.' };
}
