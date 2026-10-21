// Explizite Zustandsmaschine für Zulassungsfälle.
// Jeder erlaubte Übergang ist hier deklariert. Unbekannte oder nicht freigegebene
// Übergänge werden abgelehnt (siehe assertTransition).

export const CASE_STATUSES = [
  'SALE_CREATED',
  'INVITED',
  'PURCHASE_CONFIRMED',
  'PREPARATION',
  'REVIEW',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'AUTHORITY_PROCESSING',
  'PLATES_AND_ORIGINALS',
  'HANDOVER_RELEASABLE',
  'HANDED_OVER',
  'CLOSED',
  'ON_HOLD',
  'CANCELLED',
] as const;

export type CaseState = (typeof CASE_STATUSES)[number];

// Wer einen Übergang auslösen darf.
export type ActorSource = 'SYSTEM' | 'CUSTOMER' | 'DEALER' | 'OPERATOR' | 'PARTNER_WEBHOOK' | 'SIMULATION';

export const TERMINAL_STATES: readonly CaseState[] = ['CLOSED', 'CANCELLED'];

// Erlaubte Zielzustände je Ausgangszustand.
const GRAPH: Record<CaseState, readonly CaseState[]> = {
  SALE_CREATED: ['INVITED', 'CANCELLED'],
  INVITED: ['PURCHASE_CONFIRMED', 'CANCELLED'],
  PURCHASE_CONFIRMED: ['PREPARATION', 'ON_HOLD', 'CANCELLED'],
  PREPARATION: ['REVIEW', 'ON_HOLD', 'CANCELLED'],
  REVIEW: ['PREPARATION', 'READY_FOR_SUBMISSION', 'ON_HOLD', 'CANCELLED'],
  READY_FOR_SUBMISSION: ['SUBMITTED', 'REVIEW', 'ON_HOLD'],
  SUBMITTED: ['AUTHORITY_PROCESSING', 'ON_HOLD'],
  AUTHORITY_PROCESSING: ['PLATES_AND_ORIGINALS', 'PREPARATION', 'ON_HOLD'],
  PLATES_AND_ORIGINALS: ['HANDOVER_RELEASABLE', 'ON_HOLD'],
  HANDOVER_RELEASABLE: ['HANDED_OVER', 'PLATES_AND_ORIGINALS', 'ON_HOLD'],
  HANDED_OVER: ['CLOSED'],
  CLOSED: [],
  ON_HOLD: [],
  CANCELLED: [],
};

// Wer einen konkreten Übergang auslösen darf. Schlüssel: "VON>NACH".
const ACTORS: Partial<Record<string, readonly ActorSource[]>> = {
  'SALE_CREATED>INVITED': ['DEALER'],
  'SALE_CREATED>CANCELLED': ['DEALER', 'OPERATOR'],
  'INVITED>PURCHASE_CONFIRMED': ['CUSTOMER'],
  'INVITED>CANCELLED': ['DEALER', 'OPERATOR'],
  'PURCHASE_CONFIRMED>PREPARATION': ['SYSTEM'],
  'PURCHASE_CONFIRMED>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'PURCHASE_CONFIRMED>CANCELLED': ['DEALER', 'OPERATOR'],
  'PREPARATION>REVIEW': ['CUSTOMER', 'OPERATOR'],
  'PREPARATION>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'PREPARATION>CANCELLED': ['DEALER', 'OPERATOR'],
  'REVIEW>PREPARATION': ['OPERATOR'],
  'REVIEW>READY_FOR_SUBMISSION': ['OPERATOR'],
  'REVIEW>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'REVIEW>CANCELLED': ['DEALER', 'OPERATOR'],
  'READY_FOR_SUBMISSION>SUBMITTED': ['OPERATOR'],
  'READY_FOR_SUBMISSION>REVIEW': ['OPERATOR'],
  'READY_FOR_SUBMISSION>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'SUBMITTED>AUTHORITY_PROCESSING': ['OPERATOR', 'PARTNER_WEBHOOK', 'SIMULATION'],
  'SUBMITTED>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'AUTHORITY_PROCESSING>PLATES_AND_ORIGINALS': ['OPERATOR', 'PARTNER_WEBHOOK', 'SIMULATION'],
  'AUTHORITY_PROCESSING>PREPARATION': ['OPERATOR', 'PARTNER_WEBHOOK'],
  'AUTHORITY_PROCESSING>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'PLATES_AND_ORIGINALS>HANDOVER_RELEASABLE': ['SYSTEM', 'OPERATOR'],
  'PLATES_AND_ORIGINALS>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'HANDOVER_RELEASABLE>HANDED_OVER': ['DEALER', 'OPERATOR'],
  'HANDOVER_RELEASABLE>PLATES_AND_ORIGINALS': ['SYSTEM', 'OPERATOR'],
  'HANDOVER_RELEASABLE>ON_HOLD': ['SYSTEM', 'OPERATOR'],
  'HANDED_OVER>CLOSED': ['SYSTEM', 'OPERATOR'],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: CaseState,
    readonly to: CaseState,
    readonly reason: 'NOT_IN_GRAPH' | 'ACTOR_NOT_ALLOWED',
  ) {
    super(
      reason === 'NOT_IN_GRAPH'
        ? `Übergang ${from} → ${to} ist nicht erlaubt.`
        : `Übergang ${from} → ${to} darf von dieser Partei nicht ausgelöst werden.`,
    );
    this.name = 'InvalidTransitionError';
  }
}

export function isTerminal(state: CaseState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: CaseState, to: CaseState): boolean {
  return GRAPH[from].includes(to);
}

export function allowedActors(from: CaseState, to: CaseState): readonly ActorSource[] {
  return ACTORS[`${from}>${to}`] ?? [];
}

export function assertTransition(from: CaseState, to: CaseState, actor: ActorSource): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to, 'NOT_IN_GRAPH');
  }
  if (!allowedActors(from, to).includes(actor)) {
    throw new InvalidTransitionError(from, to, 'ACTOR_NOT_ALLOWED');
  }
}

// ON_HOLD wird nicht über den Graphen verlassen, sondern nur zurück in den gespeicherten Vorzustand.
export function resumeTargetIsValid(resumeStatus: CaseState | null, target: CaseState): boolean {
  return resumeStatus !== null && resumeStatus === target;
}
