import Link from 'next/link';
import { requireActor } from '@/auth/actor';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { MarkReadButton } from '@/components/case/client-actions';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Mitteilungen' };

export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await db.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <>
      <PageHeader title="Mitteilungen" subtitle="Hinweise zu Ihren Vorgängen. Per E-Mail gibt es im MVP nur ein Protokoll, keinen Versand." actions={<MarkReadButton />} />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="Keine Mitteilungen" text="Wir melden uns, sobald sich in Ihren Vorgängen etwas ändert." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="py-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-accent'}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(n.createdAt)}
                      {n.caseId && (
                        <>
                          {' · '}
                          <Link href={`/faelle/${n.caseId}`} className="text-accent">
                            Zum Vorgang
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
