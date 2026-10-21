import Link from 'next/link';
import { getCurrentActor } from '@/auth/actor';
import { Alert, Card, LinkButton } from '@/components/ui';
import { previewInvitation } from '@/services/sale-service';
import { formatDate } from '@/lib/format';
import { AcceptInvitationButton } from '@/components/invitation-button';

export const metadata = { title: 'Einladung' };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvitation(token);
  if (!preview) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Alert tone="danger" title="Einladung nicht gültig">
          Der Link ist abgelaufen, bereits verwendet oder unbekannt. Bitte wenden Sie sich an Ihren Händler.
        </Alert>
      </div>
    );
  }
  const actor = await getCurrentActor();
  const next = `/einladung/${token}`;
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <div>
        <p className="text-sm font-medium text-accent">Einladung von {preview.dealerName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ihr Fahrzeug ist bereit für die Zulassung.</h1>
        <p className="mt-3 text-muted">
          Die relevanten Verkaufs- und Fahrzeugdaten sind bereits vorausgefüllt. Vertrauliche Unterlagen sehen Sie erst nach der Anmeldung.
        </p>
      </div>
      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Fahrzeug</dt>
            <dd className="font-medium">{preview.make} {preview.model}</dd>
          </div>
          <div>
            <dt className="text-muted">Kanton</dt>
            <dd className="font-medium">{preview.cantonName}</dd>
          </div>
          <div>
            <dt className="text-muted">Verkaufsdatum</dt>
            <dd className="font-medium">{formatDate(preview.saleDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">Händler</dt>
            <dd className="font-medium">{preview.dealerName}</dd>
          </div>
        </dl>
      </Card>
      {actor ? (
        <div className="space-y-3">
          <AcceptInvitationButton token={token} />
          <p className="text-xs text-muted">Die Einladung gilt nur für das Konto mit der Adresse {preview.buyerEmailHint}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <LinkButton href={`/anmelden?next=${encodeURIComponent(next)}`} className="h-12 w-full">
            Anmelden und fortfahren
          </LinkButton>
          <p className="text-center text-sm text-muted">
            Noch kein Konto?{' '}
            <Link href={`/registrieren?next=${encodeURIComponent(next)}`} className="font-medium text-accent">
              Registrieren
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
