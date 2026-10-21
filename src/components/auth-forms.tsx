'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from './forms/action-form';
import { TextField, SelectField } from './forms/fields';
import { loginAction, registerAction } from '@/app/actions';
import { CANTONS } from '@/domain/cantons';


export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-4">
        <TextField name="email" label="E-Mail-Adresse" type="email" autoComplete="email" required />
        <TextField name="password" label="Passwort" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton className="mt-6 w-full h-12" pendingLabel="Anmeldung läuft …">
        Anmelden
      </SubmitButton>
    </ActionForm>
  );
}

const CANTON_OPTIONS = [
  { value: '', label: 'Bitte wählen' },
  ...Object.entries(CANTONS).map(([code, name]) => ({ value: code, label: `${name} (${code})` })),
];

export function RegisterForm({ initialType, next }: { initialType: 'CUSTOMER' | 'DEALER'; next?: string }) {
  const [type, setType] = useState<'CUSTOMER' | 'DEALER'>(initialType);
  return (
    <ActionForm action={registerAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium">Ich registriere mich als</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['CUSTOMER', 'Privatperson'],
              ['DEALER', 'Autohändler'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`transition-soft flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium ${type === value ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface'}`}
            >
              <input type="radio" name="accountType" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-4">
        <TextField name="fullName" label="Vollständiger Name" autoComplete="name" required />
        <TextField name="email" label="E-Mail-Adresse" type="email" autoComplete="email" required />
        <TextField name="password" label="Passwort" type="password" autoComplete="new-password" hint="Mindestens 10 Zeichen." required />
        {type === 'DEALER' && (
          <div className="space-y-4 rounded-2xl border border-border bg-surface-muted/50 p-4">
            <p className="text-sm font-semibold">Betrieb</p>
            <TextField name="organizationName" label="Firmenname" required />
            <TextField name="street" label="Strasse und Nr." autoComplete="street-address" required />
            <div className="grid grid-cols-3 gap-3">
              <TextField name="zip" label="PLZ" inputMode="numeric" maxLength={4} autoComplete="postal-code" required className="col-span-1" />
              <TextField name="city" label="Ort" autoComplete="address-level2" required className="col-span-2" />
            </div>
            <SelectField name="canton" label="Kanton" options={CANTON_OPTIONS} defaultValue="" required />
          </div>
        )}
      </div>
      <SubmitButton className="mt-6 w-full h-12" pendingLabel="Konto wird erstellt …">
        Konto erstellen
      </SubmitButton>
      <p className="mt-4 text-xs text-muted">Mit der Registrierung akzeptieren Sie die Nutzungsbedingungen. Die Datenschutzerklärung ist noch als Entwurf hinterlegt.</p>
    </ActionForm>
  );
}

