import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActor, isOperator } from '@/auth/actor';
import { Badge, Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { RetryTaskForm } from '@/components/case/client-actions';
import { getOperationsQueue, STATUS_LABELS } from '@/services/query-service';
import { documentKindLabel } from '@/services/document-service';
import { INSURANCE_LABELS, type InsuranceState } from '@/domain/insurance-state';
import { formatDateTime } from '@/lib/format';
import type { CaseState } from '@/domain/case-state';
import type { DocumentKind } from '@prisma/client';
import { env } from '@/lib/env';

export const metadata = { title: 'Operations' };

export default async function OperationsPage() {
  const actor = await requireActor();
  if (!isOperator(actor)) {
    redirect('/dashboard');
  }
  const queue = await getOperationsQueue();
  return (
    <>
      <PageHeader title="Operations" subtitle="Was jetzt geprüft, eingereicht oder entschieden werden muss." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Kennzahlen">
        <Stat label="Offene Prüfungen" value={queue.reviews.length} />
        <Stat label="Dokumente zu prüfen" value={queue.documentsToVerify.length} />
        <Stat label="Manuelle Einreichungen" value={queue.queuedSubmissions.length} />
        <Stat label="Fehlgeschlagene Aufgaben" value={queue.deadLetters.length} />
      </section>
      {env().DEMO_MODE && <p className="mt-4 text-xs text-muted">Demo-Modus: Die Warteschlange wird im Produktivbetrieb durch einen Hintergrundprozess abgearbeitet.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Prüfwarteschlange" description="Offene Prüfungen über alle Fälle.">
          {queue.reviews.length === 0 ? (
            <EmptyState title="Nichts offen" text="Alle Prüfungen sind erledigt." />
          ) : (
            <ul className="divide-y divide-border">
              {queue.reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <Link href={`/faelle/${r.caseId}`} className="block hover:text-accent">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted">
                      {r.case.sale.buyerName} · {r.case.canton} · {STATUS_LABELS[r.case.status as CaseState]} · {formatDateTime(r.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dokumente zur Verifikation">
          {queue.documentsToVerify.length === 0 ? (
            <EmptyState title="Keine Dokumente offen" text="Neue Uploads erscheinen hier." />
          ) : (
            <ul className="divide-y divide-border">
              {queue.documentsToVerify.map((d) => (
                <li key={d.id} className="py-3">
                  <Link href={`/faelle/${d.caseId}`} className="block hover:text-accent">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted">{documentKindLabel(d.kind as DocumentKind)} · {formatDateTime(d.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Versicherung in Bearbeitung">
          {queue.insuranceOpen.length === 0 ? (
            <EmptyState title="Keine offenen Anfragen" text="Versicherungsanfragen erscheinen hier, solange sie offen sind." />
          ) : (
            <ul className="divide-y divide-border">
              {queue.insuranceOpen.map((i) => (
                <li key={i.caseId} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/faelle/${i.caseId}`} className="text-sm font-medium hover:text-accent">
                    Fall {i.caseId.slice(0, 8)}
                  </Link>
                  <Badge tone={i.status === 'PROBLEM' ? 'danger' : 'accent'}>{INSURANCE_LABELS[i.status as InsuranceState]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Einreichungen ohne Schnittstelle" description="Daten sind gesichert. Die Einreichung erfolgt manuell.">
          {queue.queuedSubmissions.length === 0 ? (
            <EmptyState title="Keine manuellen Einreichungen" text="Alles über die Schnittstelle oder bereits erfasst." />
          ) : (
            <ul className="divide-y divide-border">
              {queue.queuedSubmissions.map((s) => (
                <li key={s.id} className="py-3">
                  <Link href={`/faelle/${s.caseId}`} className="text-sm font-medium hover:text-accent">
                    Einreichung {s.id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-muted">{formatDateTime(s.createdAt)} · Status {s.status}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fehlgeschlagene Aufgaben" description="Nach Ausschöpfen der Wiederholungen. Erneut ausführen nur mit Begründung." className="lg:col-span-2">
          {queue.deadLetters.length === 0 ? (
            <EmptyState title="Keine Fehler" text="Alle Aufgaben laufen oder sind erledigt." />
          ) : (
            <ul className="space-y-4">
              {queue.deadLetters.map((t) => (
                <li key={t.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t.type}</p>
                    <Badge tone="danger">{t.attempts} Versuche</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.lastError ?? 'Ohne Fehlermeldung'}</p>
                  <div className="mt-3">
                    <RetryTaskForm taskId={t.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
