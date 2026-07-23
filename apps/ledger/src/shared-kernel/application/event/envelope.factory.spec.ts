import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import { EnvelopeFactory } from './envelope.factory';

class Priced extends DomainEvent {
  readonly eventType = 'Priced';
  readonly schemaVersion = 1;

  constructor(
    readonly cop: string,
    readonly usd: string,
  ) {
    super();
  }

  toPayload(): EventPayload {
    return {
      cop: aMoney().of(this.cop).inCop().toDecimalString(),
      usd: aMoney().of(this.usd).inUsd().toDecimalString(),
    };
  }
}

const stream: StreamId = {
  userId: 'user-1',
  aggregateType: 'Thing',
  aggregateId: 'thing-1',
};

const ctx: AuthContext = {
  userId: 'user-1',
  clientId: 'client-x',
  externalRef: 'ref-123',
};

describe('EnvelopeFactory', () => {
  const build = () =>
    new EnvelopeFactory(
      new FixedClock(new Date('2026-07-22T10:00:00.000Z')),
      new SequentialIdGenerator(),
    );

  it('serializes amounts as decimal strings, never floats (RNF-2)', () => {
    const [envelope] = build().build(stream, 0, [new Priced('31900', '7.99')], ctx);

    expect(envelope.payload).toEqual({ cop: '31900', usd: '7.99' });
    expect(typeof (envelope.payload as { cop: unknown }).cop).toBe('string');
  });

  it('assigns consecutive sequences from the persisted head', () => {
    const envelopes = build().build(
      stream,
      4,
      [new Priced('1', '1'), new Priced('2', '2')],
      ctx,
    );

    expect(envelopes.map((e) => e.sequence)).toEqual([5, 6]);
  });

  it('stamps external_ref on the anchor event only', () => {
    const envelopes = build().build(
      stream,
      0,
      [new Priced('1', '1'), new Priced('2', '2')],
      ctx,
    );

    expect(envelopes[0].externalRef).toBe('ref-123');
    expect(envelopes[1].externalRef).toBeNull();
  });

  it('propagates userId/clientId and deterministic ids and timestamps', () => {
    const [envelope] = build().build(stream, 0, [new Priced('1', '1')], ctx);

    expect(envelope.userId).toBe('user-1');
    expect(envelope.clientId).toBe('client-x');
    expect(envelope.eventId).toBe('00000000-0000-4000-8000-000000000001');
    expect(envelope.recordedAt.toISOString()).toBe('2026-07-22T10:00:00.000Z');
  });
});
