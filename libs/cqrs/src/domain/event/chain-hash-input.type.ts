import { EventEnvelope } from './event-envelope.type';
import { EventPayload } from './event-payload.type';

/**
 * The subset of an envelope that enters the hash chain (AC-3). Every field is
 * listed explicitly — never spread from `envelope` — so that a new field
 * added to {@link EventEnvelope} fails to compile here until someone decides
 * whether it belongs in the chain or not, instead of silently entering the
 * hash. `Omit` on the type keeps that decision visible: it still requires
 * every remaining key.
 */
export type ChainHashInput = Omit<
  EventEnvelope,
  'recordedAt' | 'externalRefHash' | 'occurredAt'
> & {
  readonly occurredAt: string;
};

/**
 * Projects an envelope onto its hash input. Excluded on purpose:
 * `recordedAt` (infrastructure assigns it after the fact) and
 * `externalRefHash` (itself a derived value — including it would make a
 * future change to its own derivation retroactively invalidate the chain,
 * exactly what AC-3 exists to prevent). `globalPosition` is not part of
 * `EventEnvelope` at all, so it is excluded by construction.
 */
export function chainHashInput(envelope: EventEnvelope): ChainHashInput {
  return {
    eventId: envelope.eventId,
    userId: envelope.userId,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    sequence: envelope.sequence,
    eventType: envelope.eventType,
    schemaVersion: envelope.schemaVersion,
    clientId: envelope.clientId,
    externalRef: envelope.externalRef,
    payload: envelope.payload as EventPayload,
    occurredAt: envelope.occurredAt.toISOString(),
  };
}
