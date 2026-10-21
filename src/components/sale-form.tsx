'use client';

import { createSaleAction } from '@/app/actions';
import { CANTONS } from '@/domain/cantons';
import { ActionForm, SubmitButton } from './forms/action-form';
import { CheckField, SelectField, TextField } from './forms/fields';

const CANTON_OPTIONS = [
  { value: '', label: 'Bitte wählen' },
  ...Object.entries(CANTONS).map(([code, name]) => ({ value: code, label: `${name} (${code})` })),
];

const PREVIOUS_OPTIONS = [
  { value: 'NEVER_REGISTERED', label: 'Noch nie zugelassen' },
  { value: 'SWISS_CANTON', label: 'Zuvor in einem Schweizer Kanton' },
  { value: 'ABROAD', label: 'Zuvor im Ausland' },
  { value: 'UNKNOWN', label: 'Unbekannt' },
];

const PLATE_OPTIONS = [
  { value: 'EXISTING_PLATES_AVAILABLE', label: 'Bestehende Kontrollschilder vorhanden' },
  { value: 'NEW_PLATES_REQUIRED', label: 'Neue Kontrollschilder nötig' },
  { value: 'EXISTING_PLATES_UNKNOWN', label: 'Unklar, bitte prüfen' },
];

export function SaleForm() {
  return (
    <ActionForm action={createSaleAction}>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Fahrzeug</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="vin" label="Fahrgestellnummer (VIN)" hint="17 Zeichen, ohne I, O, Q" maxLength={24} autoComplete="off" required />
          <SelectField name="vehicleKind" label="Zustand" options={[{ value: 'USED', label: 'Occasion' }, { value: 'NEW', label: 'Neuwagen' }]} />
          <TextField name="make" label="Marke" required />
          <TextField name="model" label="Modell" required />
          <TextField name="variant" label="Variante (optional)" />
          <TextField name="firstRegistrationDate" label="Erstzulassung (optional)" type="date" />
          <TextField name="mileageKm" label="Kilometerstand (optional)" inputMode="numeric" />
          <SelectField name="previousRegistration" label="Bisherige Zulassung" options={PREVIOUS_OPTIONS} />
          <TextField name="previousCanton" label="Bisheriger Kanton (falls Schweiz)" hint="Nur wenn zuvor in der Schweiz zugelassen" maxLength={2} />
          <CheckField name="isImport" label="Importfahrzeug" />
        </div>
      </section>

      <section className="mt-8 space-y-4 border-t border-border pt-8">
        <h2 className="text-sm font-semibold">Kontrollschilder</h2>
        <SelectField name="plateSituation" label="Situation" options={PLATE_OPTIONS} />
      </section>

      <section className="mt-8 space-y-4 border-t border-border pt-8">
        <h2 className="text-sm font-semibold">Käufer und Verkauf</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="buyerName" label="Name des Käufers oder Firma" required />
          <TextField name="buyerEmail" label="E-Mail des Käufers" type="email" hint="Nur dieses Konto kann die Einladung annehmen." required />
          <CheckField name="isCompanyBuyer" label="Käufer ist eine Firma" />
          <SelectField name="canton" label="Zulassungskanton" options={CANTON_OPTIONS} defaultValue="" />
          <TextField name="saleDate" label="Verkaufsdatum" type="date" required />
          <TextField name="plannedHandoverDate" label="Geplantes Übergabedatum (optional)" type="date" />
          <TextField name="priceChf" label="Kaufpreis in CHF (optional)" inputMode="numeric" />
        </div>
      </section>

      <SubmitButton className="mt-8 h-12 w-full sm:w-auto" pendingLabel="Verkauf wird erfasst …">
        Verkauf erfassen
      </SubmitButton>
    </ActionForm>
  );
}
