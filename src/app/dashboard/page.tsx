import { redirect } from 'next/navigation';
import { requireActor, isOperator } from '@/auth/actor';

// Einstieg nach Anmeldung: je Rolle die passende Startseite.
export default async function DashboardRedirect() {
  const actor = await requireActor();
  if (isOperator(actor)) {
    redirect('/operations');
  }
  if (actor.memberships.some((m) => m.organizationType === 'DEALER')) {
    redirect('/haendler');
  }
  redirect('/kunde');
}
