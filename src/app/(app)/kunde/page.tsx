import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireActor, isOperator } from '@/auth/actor';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { listCustomerCases } from '@/services/query-service';
import { formatDate } from '@/lib/format';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Meine Fälle' };

export default async function CustomerHome() {
  const actor = await requireActor();
  if (isOperator(actor) || actor.memberships.length > 0) {
    redirect('/dashboard');
  }
  const cases = await listCustomerCases(actor);
  return (
    <>
      <PageHeader title={`Hallo ${actor.fullName.split(' ')[0]}`} subtitle="Hier sehen Sie den Stand Ihrer Fahrzeugzulassungen." />
      {cases.length === 0 ? (
        <Card>
          <EmptyState
            title="Noch kein Vorgang"
            text="Sobald Ihr Händler Ihnen einen Einladungslink schickt, erscheint Ihr Fahrzeug hier. Den Link öffnen Sie einfach im Browser."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cases.map((item) => (
            <li key={item.id}>
              <Link href={`/faelle/${item.id}`} className="transition-soft group block rounded-2xl border border-border bg-surface p-5 hover:border-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.vehicleLabel}</p>
                    <p className="mt-0.5 text-sm text-muted">{item.dealerName} · {item.canton}</p>
                  </div>
                  <ChevronRight className="mt-1 size-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone={item.status === 'CLOSED' ? 'success' : item.status === 'ON_HOLD' ? 'warning' : 'accent'}>{item.statusLabel}</Badge>
                  <span className="text-xs text-muted">Aktualisiert {formatDate(item.updatedAt)}</span>
                </div>
                {item.nextAction && <p className="mt-3 text-sm">{item.nextAction}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
