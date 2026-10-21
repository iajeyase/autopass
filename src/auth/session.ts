import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { generateToken, sha256Hex } from '@/lib/security';

export const SESSION_COOKIE = 'ap_session';

// Erstellt eine Session. Der Klartext-Token geht nur in das Cookie, die Datenbank speichert den Hash.
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.session.create({
    data: { userId, tokenHash: sha256Hex(token), expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().APP_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  }
  store.delete(SESSION_COOKIE);
}

// Liefert den Benutzer zur gültigen, nicht abgelaufenen Session oder null.
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const session = await db.session.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return session.userId;
}
