'use client';

import { createContext, useContext, useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/errors';
import { Alert } from '@/components/ui';
import { buttonClass } from '@/components/ui';

type FieldErrors = Record<string, string>;

const FormContext = createContext<FieldErrors>({});

// Liest die Feldfehler aus dem letzten Ergebnis der Server Action.
export function useFieldError(name: string): string | undefined {
  return useContext(FormContext)[name];
}

export function SubmitButton({
  children,
  variant = 'primary',
  className,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)} aria-busy={pending}>
      {pending ? (pendingLabel ?? 'Wird verarbeitet …') : children}
    </button>
  );
}

// Formular, das eine Server Action aufruft. Zeigt Gesamtfehler und Feldfehler sowie Erfolgsmeldungen.
export function ActionForm<T = void>({
  action,
  children,
  className,
  successMessage,
}: {
  action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;
  children: ReactNode;
  className?: string;
  successMessage?: string | ((data: T) => string);
}) {
  const [state, formAction] = useActionState(action, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const successText =
    state?.ok && successMessage
      ? typeof successMessage === 'function'
        ? successMessage(state.data)
        : successMessage
      : null;
  return (
    <FormContext.Provider value={fieldErrors}>
      <form action={formAction} className={className} noValidate>
        {state && !state.ok && <Alert tone="danger" className="mb-4">{state.error}</Alert>}
        {successText && <Alert tone="success" className="mb-4">{successText}</Alert>}
        {children}
      </form>
    </FormContext.Provider>
  );
}
