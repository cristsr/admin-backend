import { chainHashInput } from './chain-hash-input.type';
import { EventEnvelope } from './event-envelope.type';

const envelope: EventEnvelope = {
  eventId: 'evt-1',
  userId: 'user-1',
  aggregateType: 'Transaction',
  aggregateId: 'agg-1',
  sequence: 1,
  eventType: 'TransactionRecorded',
  schemaVersion: 1,
  clientId: 'client-x',
  externalRef: 'ref-1',
  externalRefHash: 'abc123',
  payload: { amount: '31900' },
  occurredAt: new Date('2026-07-20T10:00:00.000Z'),
  recordedAt: new Date('2026-07-20T10:00:05.000Z'),
};

describe('chainHashInput', () => {
  it('includes every envelope field relevant to the decision it records', () => {
    const input = chainHashInput(envelope);

    expect(input).toEqual({
      eventId: 'evt-1',
      userId: 'user-1',
      aggregateType: 'Transaction',
      aggregateId: 'agg-1',
      sequence: 1,
      eventType: 'TransactionRecorded',
      schemaVersion: 1,
      clientId: 'client-x',
      externalRef: 'ref-1',
      payload: { amount: '31900' },
      occurredAt: '2026-07-20T10:00:00.000Z',
    });
  });

  it('excludes recordedAt (infrastructure timestamp, AC-3)', () => {
    const input = chainHashInput(envelope) as Record<string, unknown>;

    expect(input).not.toHaveProperty('recordedAt');
  });

  it('excludes externalRefHash (derived value, AC-3)', () => {
    const input = chainHashInput(envelope) as Record<string, unknown>;

    expect(input).not.toHaveProperty('externalRefHash');
  });

  it('serializes occurredAt as ISO 8601, not as a Date instance', () => {
    const input = chainHashInput(envelope);

    expect(typeof input.occurredAt).toBe('string');
    expect(input.occurredAt).toBe('2026-07-20T10:00:00.000Z');
  });
});
