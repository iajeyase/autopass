'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Alert, buttonClass } from '@/components/ui';
import type { ActionResult } from '@/lib/errors';

// Einzelne Aktion ohne Formularfelder (z. B. "Verifizieren", "Einreichung starten").
export function ActionButton<T>({
  run,
  children,
  pendingLabel = 'Wird ausgeführt …',
  variant = 'primary',
  confirmText,
  successText,
  className,
  onResult,
}: {
  run: () => Promise<ActionResult<T>>;
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  confirmText?: string;
  successText?: string;
  className?: string;
  onResult?: (data: T) => ReactNode;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactNode | null>(null);

  function handleClick() {
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setError(null);
    start(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(onResult ? onResult(result.data) : (successText ?? null));
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={pending} className={buttonClass(variant, className)} aria-busy={pending}>
        {pending ? pendingLabel : children}
      </button>
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
    </div>
  );
}
