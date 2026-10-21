'use client';

import { acceptInvitationAction } from '@/app/actions';
import { ActionButton } from './forms/action-button';

export function AcceptInvitationButton({ token }: { token: string }) {
  return (
    <ActionButton run={() => acceptInvitationAction(token)} pendingLabel="Vorgang wird geöffnet …" className="h-12 w-full">
      Vorgang öffnen
    </ActionButton>
  );
}
