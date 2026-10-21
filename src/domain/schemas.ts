import { z } from 'zod';
import { CANTON_CODES } from './cantons';
import { isValidVin, normalizeVin } from './vin';

// Eingabevalidierung mit Zod. Fehlermeldungen sind für Endbenutzer formuliert (de-CH).

const cantonSchema = z.enum(CANTON_CODES as [string, ...string[]], {
  message: 'Bitte wählen Sie einen gültigen Kanton.',
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' }));

export const passwordSchema = z
  .string()
  .min(10, { message: 'Das Passwort muss mindestens 10 Zeichen lang sein.' })
  .max(200, { message: 'Das Passwort ist zu lang.' });

export const registerSchema = z
  .object({
    accountType: z.enum(['CUSTOMER', 'DEALER'], { message: 'Bitte wählen Sie einen Kontotyp.' }),
    fullName: z.string().trim().min(2, { message: 'Bitte geben Sie Ihren Namen ein.' }).max(120),
    email: emailSchema,
    password: passwordSchema,
    organizationName: z.string().trim().max(160).optional().or(z.literal('')),
    street: z.string().trim().max(160).optional().or(z.literal('')),
    zip: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().max(120).optional().or(z.literal('')),
    canton: z.string().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.accountType === 'DEALER') {
      if (!value.organizationName) {
        ctx.addIssue({ code: 'custom', path: ['organizationName'], message: 'Bitte geben Sie den Firmennamen an.' });
      }
      if (!value.street) {
        ctx.addIssue({ code: 'custom', path: ['street'], message: 'Bitte geben Sie die Strasse an.' });
      }
      if (!value.zip || !/^\d{4}$/.test(value.zip)) {
        ctx.addIssue({ code: 'custom', path: ['zip'], message: 'Die PLZ besteht aus vier Ziffern.' });
      }
      if (!value.city) {
        ctx.addIssue({ code: 'custom', path: ['city'], message: 'Bitte geben Sie den Ort an.' });
      }
      if (!value.canton || !CANTON_CODES.includes(value.canton as (typeof CANTON_CODES)[number])) {
        ctx.addIssue({ code: 'custom', path: ['canton'], message: 'Bitte wählen Sie einen Kanton.' });
      }
    }
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Bitte geben Sie Ihr Passwort ein.' }).max(200),
});

export const saleSchema = z
  .object({
    vin: z
      .string()
      .transform(normalizeVin)
      .refine((v) => isValidVin(v), { message: 'Die Fahrgestellnummer hat 17 Zeichen (ohne I, O, Q).' }),
    make: z.string().trim().min(2, { message: 'Bitte geben Sie die Marke an.' }).max(60),
    model: z.string().trim().min(1, { message: 'Bitte geben Sie das Modell an.' }).max(80),
    variant: z.string().trim().max(120).optional().or(z.literal('')),
    vehicleKind: z.enum(['NEW', 'USED'], { message: 'Bitte wählen Sie Neuwagen oder Occasion.' }),
    isImport: z.boolean(),
    firstRegistrationDate: z.string().optional().or(z.literal('')),
    mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
    previousRegistration: z.enum(['NEVER_REGISTERED', 'SWISS_CANTON', 'ABROAD', 'UNKNOWN']),
    previousCanton: z.string().optional().or(z.literal('')),
    plateSituation: z.enum(['EXISTING_PLATES_AVAILABLE', 'EXISTING_PLATES_UNKNOWN', 'NEW_PLATES_REQUIRED']),
    buyerName: z.string().trim().min(2, { message: 'Bitte geben Sie den Namen des Käufers an.' }).max(160),
    buyerEmail: emailSchema,
    isCompanyBuyer: z.boolean(),
    canton: cantonSchema,
    saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Bitte geben Sie das Verkaufsdatum an.' }),
    plannedHandoverDate: z.string().optional().or(z.literal('')),
    priceChf: z.coerce.number().int().min(0).max(10_000_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.vehicleKind === 'NEW' && value.previousRegistration !== 'NEVER_REGISTERED') {
      ctx.addIssue({
        code: 'custom',
        path: ['previousRegistration'],
        message: 'Ein Neuwagen ist noch nie zugelassen gewesen.',
      });
    }
    if (value.previousRegistration === 'SWISS_CANTON' && !value.previousCanton) {
      ctx.addIssue({ code: 'custom', path: ['previousCanton'], message: 'Bitte geben Sie den bisherigen Kanton an.' });
    }
    if (value.plateSituation === 'EXISTING_PLATES_AVAILABLE' && value.vehicleKind === 'NEW') {
      ctx.addIssue({
        code: 'custom',
        path: ['plateSituation'],
        message: 'Bei einem Neuwagen sind in der Regel keine Kontrollschilder vorhanden.',
      });
    }
  });

export const customerProfileSchema = z.object({
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  street: z.string().trim().min(2, { message: 'Bitte geben Sie Ihre Strasse an.' }).max(160),
  zip: z.string().trim().regex(/^\d{4}$/, { message: 'Die PLZ besteht aus vier Ziffern.' }),
  city: z.string().trim().min(2, { message: 'Bitte geben Sie Ihren Ort an.' }).max(120),
  canton: cantonSchema,
});

export const confirmPurchaseSchema = z.object({
  acceptProcessConfirmation: z.literal(true, {
    message: 'Bitte bestätigen Sie die Angaben. Dies ist eine Prozessbestätigung und ersetzt keinen Kaufvertrag.',
  }),
  acceptDataProcessing: z.literal(true, {
    message: 'Bitte stimmen Sie der Bearbeitung Ihrer Daten für den Zulassungsprozess zu.',
  }),
});

export const reasonSchema = z
  .string()
  .trim()
  .min(10, { message: 'Bitte begründen Sie die Entscheidung mit mindestens 10 Zeichen.' })
  .max(1000);

export const referenceSchema = z
  .string()
  .trim()
  .min(3, { message: 'Bitte geben Sie eine Referenz oder Belegnummer an.' })
  .max(120);

export type SaleInput = z.infer<typeof saleSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
