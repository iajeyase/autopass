import { redirect } from 'next/navigation';
import { requireActor, isAdmin } from '@/auth/actor';
import { Badge, Card, PageHeader, Stat } from '@/components/ui';
import { getAdminOverview } from '@/services/query-service';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Administration' };

export default async function AdminPage() {
  const actor = await requireActor();
  if (!isAdmin(actor)) {
    redirect('/dashboard');
  }
  const overview = await getAdminOverview();
  return (
    <>
      <PageHeader title="Administration" subtitle="Kantonale Regelwerke, Systemkennzahlen und Audit-Protokoll." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Kennzahlen">
        <Stat label="Benutzer" value={overview.counts.users} />
        <Stat label="Organisationen" value={overview.counts.organizations} />
        <Stat label="Zulassungsfälle" value={overview.counts.cases} />
        <Stat label="Fehlgeschlagene Aufgaben" value={overview.counts.deadLetters} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card title="Regelwerke" description="Versioniert. Ein Fall behält die Version, mit der er geplant wurde.">
          <ul className="divide-y divide-border">
            {overview.rulesets.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.canton === 'XX' ? 'Generisch (Fallback)' : r.canton} · v{r.version}</p>
                  <Badge tone={r.status === 'VERIFIED' ? 'success' : 'warning'}>{r.status === 'VERIFIED' ? 'Verifiziert' : 'Nicht verifiziert'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{r.ruleCount} Regeln · {r.sourceUrls.join(', ')}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Audit-Protokoll" description="Die letzten 100 Einträge.">
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Zeit</th>
                  <th className="py-2 pr-3 font-medium">Aktion</th>
                  <th className="py-2 font-medium">Objekt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.auditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{formatDateTime(entry.createdAt)}</td>
                    <td className="py-2 pr-3 font-mono">{entry.action}</td>
                    <td className="py-2 text-muted">{entry.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
