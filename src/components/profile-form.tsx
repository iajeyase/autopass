'use client';

import { saveProfileAction } from '@/app/actions';
import { CANTONS } from '@/domain/cantons';
import { ActionForm, SubmitButton } from './forms/action-form';
import { SelectField, TextField } from './forms/fields';

const CANTON_OPTIONS = [
  { value: '', label: 'Bitte wählen' },
  ...Object.entries(CANTONS).map(([code, name]) => ({ value: code, label: `${name} (${code})` })),
];

export function ProfileForm({ defaults }: { defaults: { phone: string; street: string; zip: string; city: string; canton: string } }) {
  return (
    <ActionForm action={saveProfileAction} successMessage="Profil gespeichert.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="phone" label="Telefon" type="tel" autoComplete="tel" defaultValue={defaults.phone} />
        <SelectField name="canton" label="Wohnkanton" options={CANTON_OPTIONS} defaultValue={defaults.canton} />
        <TextField name="street" label="Strasse und Nr." autoComplete="street-address" defaultValue={defaults.street} className="sm:col-span-2" />
        <TextField name="zip" label="PLZ" inputMode="numeric" maxLength={4} autoComplete="postal-code" defaultValue={defaults.zip} />
        <TextField name="city" label="Ort" autoComplete="address-level2" defaultValue={defaults.city} />
      </div>
      <SubmitButton className="mt-6 h-11">Speichern</SubmitButton>
    </ActionForm>
  );
}
