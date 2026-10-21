import 'server-only';
import { redirect } from 'next/navigation';
import { DomainError } from '@/lib/errors';
import { getSessionUserId } from './session';
import { loadActor, type Actor } from './policy';

export * from './policy';

export async function getCurrentActor(): Promise<Actor | null> {
  const userId = await getSessionUserId();
  return userId ? loadActor(userId) : null;
}

// Für Seiten: ohne Anmeldung zur Login-Seite umleiten.
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect('/anmelden');
  }
  return actor;
}

// Für Server Actions: wirft statt umzuleiten.
export async function requireActorForAction(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new DomainError('UNAUTHENTICATED', 'Bitte melden Sie sich an.');
  }
  return actor;
}
