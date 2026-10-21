// Berechtigungsregeln ohne Next-Abhängigkeit. Wird von Services, Skripten und Tests genutzt.
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';

export type PlatformRole = 'NONE' | 'OPERATOR' | 'ADMIN';
export type OrgRole = 'ORG_ADMIN' | 'ORG_STAFF';

// Der handelnde Benutzer mit allen Berechtigungen. Services prüfen Zugriffe anhand dieses Objekts.
export interface Actor {
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  memberships: { organizationId: string; organizationName: string; organizationType: string; role: OrgRole }[];
}

export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) {
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    platformRole: user.platformRole,
    memberships: user.memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationType: m.organization.type,
      role: m.role,
    })),
  };
}

export function isOperator(actor: Actor): boolean {
  return actor.platformRole === 'OPERATOR' || actor.platformRole === 'ADMIN';
}

export function isAdmin(actor: Actor): boolean {
  return actor.platformRole === 'ADMIN';
}

export function membershipIn(actor: Actor, organizationId: string) {
  return actor.memberships.find((m) => m.organizationId === organizationId) ?? null;
}

// Objektbezogene Autorisierung für Zulassungsfälle.
// Erlaubt: Mitglieder der verkaufenden Organisation, der zugeordnete Kunde, Operatoren.
export function canAccessCase(actor: Actor, caseRow: { organizationId: string; customerUserId: string | null }): boolean {
  if (isOperator(actor)) {
    return true;
  }
  if (caseRow.customerUserId === actor.userId) {
    return true;
  }
  return membershipIn(actor, caseRow.organizationId) !== null;
}

export function assertCaseAccess(actor: Actor, caseRow: { organizationId: string; customerUserId: string | null }): void {
  if (!canAccessCase(actor, caseRow)) {
    // Bewusst kein Unterschied zu "nicht gefunden", damit fremde IDs nicht erkennbar sind.
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
}

// Händlerseitige Schreibrechte: Mitglied der Organisation, optional mit Admin-Rolle.
export function assertOrgMember(actor: Actor, organizationId: string, options: { adminOnly?: boolean } = {}): OrgRole {
  const membership = membershipIn(actor, organizationId);
  if (!membership) {
    throw new DomainError('NOT_FOUND', 'Der Datensatz wurde nicht gefunden.');
  }
  if (options.adminOnly && membership.role !== 'ORG_ADMIN') {
    throw new DomainError('FORBIDDEN', 'Diese Aktion ist Organisations-Administratoren vorbehalten.');
  }
  return membership.role;
}

export function assertOperator(actor: Actor): void {
  if (!isOperator(actor)) {
    throw new DomainError('FORBIDDEN', 'Diese Aktion ist dem Operations-Team vorbehalten.');
  }
}

export function assertAdmin(actor: Actor): void {
  if (!isAdmin(actor)) {
    throw new DomainError('FORBIDDEN', 'Diese Aktion ist dem Administrator vorbehalten.');
  }
}
