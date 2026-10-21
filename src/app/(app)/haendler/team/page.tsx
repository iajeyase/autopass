import { redirect } from 'next/navigation';
import { requireActor, isOperator } from '@/auth/actor';
import { Badge, Card, PageHeader } from '@/components/ui';
import { TeamMemberForm } from '@/components/case/client-actions';
import { db } from '@/lib/db';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const actor = await requireActor();
  const dealer = actor.memberships.find((m) => m.organizationType === 'DEALER');
  if (isOperator(actor) || !dealer) {
    redirect('/dashboard');
  }
  const members = await db.organizationMember.findMany({
    where: { organizationId: dealer.organizationId },
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const isAdmin = dealer.role === 'ORG_ADMIN';
  return (
    <>
      <PageHeader title="Team" subtitle={`Mitarbeitende von ${dealer.organizationName}. Nur Administratoren verwalten das Team.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card title="Mitglieder">
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.user.fullName}</p>
                  <p className="truncate text-sm text-muted">{m.user.email}</p>
                </div>
                <Badge tone={m.role === 'ORG_ADMIN' ? 'accent' : 'neutral'}>{m.role === 'ORG_ADMIN' ? 'Administrator' : 'Mitarbeitende'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        {isAdmin && (
          <Card title="Mitglied hinzufügen" description="Die Person braucht bereits ein AutoPass-Konto.">
            <TeamMemberForm />
          </Card>
        )}
      </div>
    </>
  );
}
