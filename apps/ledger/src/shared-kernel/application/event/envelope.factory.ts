import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';

/**
 * Wraps a batch of {@link DomainEvent}s into append-ready {@link EventEnvelope}s.
 * Sequences continue from the aggregate's persisted head; ids and timestamps
 * come from the injected {@link Clock}/{@link IdGenerator} (deterministic in
 * tests). The `external_ref` is stamped on the anchor (first) event only, so a
 * multi-event command remains idempotent by a single key (INV-10).
 */
export class EnvelopeFactory {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  build(
    stream: StreamId,
    fromVersion: number,
    events: readonly DomainEvent[],
    ctx: AuthContext,
  ): EventEnvelope[] {
    const recordedAt = this.clock.now();

    return events.map((event, index) => ({
      eventId: this.idGenerator.next(),
      userId: stream.userId,
      aggregateType: stream.aggregateType,
      aggregateId: stream.aggregateId,
      sequence: fromVersion + index + 1,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      clientId: ctx.clientId,
      externalRef: index === 0 ? ctx.externalRef : null,
      payload: event.toPayload(),
      // The fact's own instant when it carries one (a bank notification is not
      // simultaneous with the request that reports it); otherwise both coincide.
      occurredAt: event.occurredAt() ?? recordedAt,
      recordedAt,
    }));
  }
}
