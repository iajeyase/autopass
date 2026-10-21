import { createSession, destroySession } from '@/auth/session';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { consumeRateLimit, hashPassword, resetRateLimit, verifyPassword } from '@/lib/security';
import { type LoginInput, type RegisterInput } from '@/domain/schemas';
import { audit } from './shared';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function registerAccount(input: RegisterInput): Promise<{ userId: string }> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new DomainError('VALIDATION', 'Die Registrierung ist fehlgeschlagen.', {
      email: 'Für diese E-Mail-Adresse existiert bereits ein Konto.',
    });
  }
  const passwordHash = await hashPassword(input.password);

  const userId = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, fullName: input.fullName, passwordHash },
    });
    if (input.accountType === 'DEALER') {
      const organization = await tx.organization.create({
        data: {
          type: 'DEALER',
          name: input.organizationName ?? '',
          street: input.street ?? '',
          zip: input.zip ?? '',
          city: input.city ?? '',
          canton: input.canton ?? '',
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: 'ORG_ADMIN' },
      });
      await audit(tx, {
        actorUserId: user.id,
        organizationId: organization.id,
        action: 'organization.created',
        entityType: 'Organization',
        entityId: organization.id,
      });
    }
    await audit(tx, { actorUserId: user.id, action: 'user.registered', entityType: 'User', entityId: user.id, metadata: { accountType: input.accountType } });
    return user.id;
  });

  await createSession(userId);
  return { userId };
}

// Gleiche Meldung für unbekannte E-Mail und falsches Passwort, um Kontenaufzählung zu erschweren.
export async function loginWithPassword(input: LoginInput, clientKey: string): Promise<void> {
  const limiterKey = `login:${input.email}:${clientKey}`;
  if (!consumeRateLimit(limiterKey, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
    throw new DomainError('RATE_LIMITED', 'Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.');
  }

  const user = await db.user.findUnique({ where: { email: input.email } });
  // Gleiche Rechenzeit auch bei unbekannter E-Mail
  const valid = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA').then(() => false);

  if (!user || !valid) {
    await db.auditLog.create({
      data: { actorUserId: user?.id ?? null, action: 'auth.login_failed', entityType: 'User', entityId: user?.id ?? input.email },
    });
    throw new DomainError('UNAUTHENTICATED', 'E-Mail-Adresse oder Passwort ist nicht korrekt.');
  }

  resetRateLimit(limiterKey);
  await createSession(user.id);
  await db.auditLog.create({ data: { actorUserId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id } });
}

export async function logout(): Promise<void> {
  await destroySession();
}
