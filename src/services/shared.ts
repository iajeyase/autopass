import type { EventSource, Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';

export type Json = Prisma.InputJsonValue;

// Schreibt einen Audit-Eintrag. Wird immer innerhalb derselben Transaktion wie die Fachänderung aufgerufen.
export async function audit(
  tx: Tx,
  entry: {
    actorUserId: string | null;
    organizationId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      organizationId: entry.organizationId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: (entry.metadata ?? undefined) as Json | undefined,
    },
  });
}

export interface NotificationPayload {
  caseId: string | null;
  kind: string;
  title: string;
  body: string;
}

// In-App-Benachrichtigungen. E-Mail wird nur protokolliert (siehe adapters/notifications/email.ts).
export async function notifyUsers(tx: Tx, userIds: string[], payload: NotificationPayload): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return;
  }
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      caseId: payload.caseId,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      emailStatus: 'LOGGED_ONLY' as const,
    })),
  });
}

export async function notifyOrgMembers(tx: Tx, organizationId: string, payload: NotificationPayload): Promise<void> {
  const members = await tx.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  await notifyUsers(
    tx,
    members.map((m) => m.userId),
    payload,
  );
}

export type EventSourceValue = EventSource;
