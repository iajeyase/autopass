import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { INSURANCE_STATES } from '@/domain/insurance-state';
import { ingestInsuranceEvent } from '@/services/insurance-service';
import { DomainError } from '@/lib/errors';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024;

const payloadSchema = z.object({
  externalEventId: z.string().min(1).max(120),
  caseId: z.uuid(),
  status: z.enum(INSURANCE_STATES),
  note: z.string().max(500).optional(),
});

function signatureMatches(raw: string, header: string | null): boolean {
  if (!header) {
    return false;
  }
  const expected = `sha256=${createHmac('sha256', env().INSURANCE_DEMO_WEBHOOK_SECRET).update(raw).digest('hex')}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS_BY_ERROR: Partial<Record<DomainError['code'], number>> = {
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  FORBIDDEN: 403,
  VALIDATION: 422,
};

// Eingehende Versicherungsereignisse. Signiert per HMAC-SHA256, idempotent über externalEventId.
// Im Demo-Modus wird jedes Ereignis als Simulation gespeichert und nie als reale Bestätigung gewertet.
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Zu grosse Anfrage.' }, { status: 413 });
  }
  if (!signatureMatches(raw, request.headers.get('x-autopass-signature'))) {
    return Response.json({ error: 'Ungültige Signatur.' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Ungültiges JSON.' }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'Ungültige Nutzlast.' }, { status: 422 });
  }

  try {
    const outcome = await ingestInsuranceEvent({
      providerKey: 'DEMO_INSURER',
      externalEventId: parsed.data.externalEventId,
      caseId: parsed.data.caseId,
      toStatus: parsed.data.status,
      source: env().DEMO_MODE ? 'SIMULATION' : 'PARTNER_WEBHOOK',
      actorUserId: null,
      note: parsed.data.note ?? null,
      evidenceDocumentId: null,
    });
    return Response.json({ status: outcome });
  } catch (error) {
    if (error instanceof DomainError) {
      return Response.json({ error: error.message }, { status: STATUS_BY_ERROR[error.code] ?? 400 });
    }
    console.error('[autopass] Webhook fehlgeschlagen', error);
    return Response.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}
