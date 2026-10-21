'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/components/ui';
import { useFieldError } from './action-form';

const INPUT =
  'transition-soft mt-1.5 block w-full min-h-11 rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15';

function FieldShell({ name, label, hint, children }: { name: string; label: string; hint?: string; children: ReactNode }) {
  const error = useFieldError(name);
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: string }) {
  const error = useFieldError(name);
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(INPUT, error ? 'border-danger' : 'border-border', className)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; hint?: string; options: { value: string; label: string }[] }) {
  const error = useFieldError(name);
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(INPUT, 'pr-8', error ? 'border-danger' : 'border-border', className)}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string; hint?: string }) {
  const error = useFieldError(name);
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(INPUT, 'min-h-24', error ? 'border-danger' : 'border-border', className)}
        {...props}
      />
    </FieldShell>
  );
}

export function CheckField({ name, label, error: externalError }: { name: string; label: ReactNode; error?: string }) {
  const error = useFieldError(name) ?? externalError;
  return (
    <div className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        className="mt-1 size-5 shrink-0 rounded border-border accent-[var(--accent)]"
      />
      <div>
        <label htmlFor={name} className="text-sm leading-6">
          {label}
        </label>
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
