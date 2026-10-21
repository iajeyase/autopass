import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActor, isOperator } from '@/auth/actor';
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { getDealerDashboard, listDealerCases } from '@/services/query-service';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Händlerübersicht' };

export default async function DealerHome() {
  const actor = await requireActor();
  const dealer = actor.memberships.find((m) => m.organizationType === 'DEALER');
  if (isOperator(actor)) {
    redirect('/operations');
  }
  if (!dealer) {
    redirect('/kunde');
  }
  const [dashboard, cases] = await Promise.all([getDealerDashboard(actor, dealer.organizationId), listDealerCases(actor, dealer.organizationId)]);
  const k = dashboard.kpis;
  return (
    <>
      <PageHeader
        title={dealer.organizationName}
        subtitle="Offene Verkäufe, Zulassungen und Übergaben auf einen Blick."
        actions={<LinkButton href="/haendler/verkauf/neu">Neuer Verkauf</LinkButton>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Kennzahlen">
        <Stat label="Offene Fälle" value={k.openCases} />
        <Stat label="Warten auf Käufer" value={k.awaitingCustomer} />
        <Stat label="Dokumente fehlen" value={k.missingDocuments} />
        <Stat label="Verzögert (>14 Tage)" value={k.criticalDelays} />
        <Stat label="Abgeschlossen" value={k.completedCases} />
        <Stat label="Ø Bearbeitungsdauer" value={k.averageDays === null ? '–' : `${k.averageDays} T.`} />
        <Stat label="Übergaben (7 Tage)" value={k.upcomingHandovers} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card title="Fälle" description="Alle Vorgänge Ihrer Organisation.">
          {cases.length === 0 ? (
            <EmptyState title="Noch keine Fälle" text="Erfassen Sie Ihren ersten Verkauf. Der Zulassungsfall entsteht automatisch." />
          ) : (
            <ul className="divide-y divide-border">
              {cases.map((item) => (
                <li key={item.id}>
                  <Link href={`/faelle/${item.id}`} className="transition-soft -mx-2 flex flex-col gap-1 rounded-lg px-2 py-3 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.vehicleLabel}</p>
                      <p className="truncate text-sm text-muted">{item.buyerName} · {item.canton}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.openReviewCount > 0 && <Badge tone="warning">{item.openReviewCount} offen</Badge>}
                      <Badge tone={item.status === 'ON_HOLD' ? 'warning' : 'accent'}>{item.statusLabel}</Badge>
                      <span className="hidden text-xs text-muted sm:inline">{formatDate(item.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Aufmerksamkeit nötig">
          {dashboard.attention.length === 0 ? (
            <Alert tone="success">Keine offenen Punkte.</Alert>
          ) : (
            <ul className="space-y-3">
              {dashboard.attention.map((item) => (
                <li key={`${item.caseId}-${item.reason}-${item.title}`}>
                  <Link href={`/faelle/${item.caseId}`} className="block rounded-xl border border-border p-3 hover:border-accent/40">
                    <p className="text-xs font-medium text-warning">{item.reason}</p>
                    <p className="mt-0.5 text-sm">{item.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
