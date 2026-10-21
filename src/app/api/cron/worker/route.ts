import { env } from '@/lib/env';
import { processDueTasks } from '@/services/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron ruft diese Route mit "Authorization: Bearer <CRON_SECRET>" auf.
// Verarbeitet einen Stapel fälliger Aufgaben. Für minutengenaue Verarbeitung den Worker-Prozess betreiben (siehe docs/07).
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Nicht berechtigt.' }, { status: 401 });
  }
  const summary = await processDueTasks({ limit: 20 });
  return Response.json(summary);
}
