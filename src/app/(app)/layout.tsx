import { redirect } from 'next/navigation';
import { requireActor } from '@/auth/actor';
import { AppShell } from '@/components/app-shell';
import { db } from '@/lib/db';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  if (!actor) {
    redirect('/anmelden');
  }
  const unreadCount = await db.notification.count({ where: { userId: actor.userId, readAt: null } });
  return (
    <AppShell actor={actor} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
