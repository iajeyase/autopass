import { getCurrentActor } from '@/auth/actor';
import { getDocumentVersionForDownload } from '@/services/document-service';
import { DomainError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dokumentdownload nur für berechtigte Personen. Antwort wird nie zwischengespeichert.
export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) {
    return new Response('Bitte melden Sie sich an.', { status: 401 });
  }
  const { versionId } = await params;
  if (!UUID.test(versionId)) {
    return new Response('Nicht gefunden.', { status: 404 });
  }
  try {
    const file = await getDocumentVersionForDownload(actor, versionId);
    return new Response(new Uint8Array(file.content), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') {
      return new Response('Nicht gefunden.', { status: 404 });
    }
    console.error('[autopass] Dokumentdownload fehlgeschlagen', error);
    return new Response('Fehler beim Laden des Dokuments.', { status: 500 });
  }
}
