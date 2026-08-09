import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { canonicalJson, sha256Hex } from '@shared';

export type MakeChainFixture = () => Promise<{ store: EventStore; reader: EventChainReader }>;

let counter = 0;
let uuidSequence = 0;
const uuidByLabel = new Map<string, string>();

/**
 * Maps a readable label to a stable UUID so the same contract is valid
 * against both the in-memory double and PostgreSQL's `uuid` columns —
 * mirrors the identical helper in `event-store.contract.ts` (kept separate
 * since the two files have independent counter state).
 */
function uuidFor(label: string): string {
  const existing = uuidByLabel.get(label);

  if (existing) return existing;

  uuidSequence += 1;
  const value = `00000000-0000-4000-9000-${uuidSequence.toString(16).padStart(12, '0')}`;
  uuidByLabel.set(label, value);

  return value;
}

function streamFor(userLabel: string, aggregateLabel: string): StreamId {
  return {
    userId: uuidFor(userLabel),
    aggregateType: 'Thing',
    aggregateId: uuidFor(aggregateLabel),
  };
}

function anEnvelope(stream: StreamId, sequence: number): EventEnvelope {
  counter += 1;
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`,
    userId: stream.userId,
    aggregateType: stream.aggregateType,
    aggregateId: stream.aggregateId,
    sequence,
    eventType: 'ThingHappened',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: null,
    externalRefHash: null,
    payload: { amount: '31900' },
    occurredAt: now,
    recordedAt: now,
  };
}

/**
 * The chain-specific half of the {@link EventStore} contract (AC-1, AC-2,
 * AC-3): every adapter that writes a chain must also make it readable and
 * verifiable through the same rules, in-memory or PostgreSQL alike.
 */
export function describeEventChainReaderContract(
  makeFixture: MakeChainFixture,
  teardown?: () => Promise<void>,
): void {
  describe('EventChainReader contract', () => {
    afterEach(async () => {
      await teardown?.();
    });

    it('chains the first event of a user against the empty string genesis', async () => {
      const { store, reader } = await makeFixture();
      const stream = streamFor('user-1', 'agg-1');
      const envelope = anEnvelope(stream, 1);

      await store.append(stream, 0, [envelope]);

      const [row] = await reader.readChain(stream.userId, 0n, 10);
      const expectedCanonical = await canonicalJson({
        eventId: envelope.eventId,
        userId: envelope.userId,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        sequence: envelope.sequence,
        eventType: envelope.eventType,
        schemaVersion: envelope.schemaVersion,
        clientId: envelope.clientId,
        externalRef: envelope.externalRef,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt.toISOString(),
      });

      expect(row.hash).toBe(sha256Hex('' + expectedCanonical));
    });

    it('chains the second event of a user against the first hash', async () => {
      const { store, reader } = await makeFixture();
      const stream = streamFor('user-1', 'agg-1');

      await store.append(stream, 0, [anEnvelope(stream, 1)]);
      await store.append(stream, 1, [anEnvelope(stream, 2)]);

      const rows = await reader.readChain(stream.userId, 0n, 10);

      expect(rows).toHaveLength(2);
      const expectedSecond = sha256Hex(rows[0].hash + (await canonicalJson(rows[1].chainInput)));
      expect(rows[1].hash).toBe(expectedSecond);
    });

    it('chains across different aggregates of the same user, in append order', async () => {
      const { store, reader } = await makeFixture();
      const a = streamFor('user-1', 'agg-a');
      const b = streamFor('user-1', 'agg-b');

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const rows = await reader.readChain(a.userId, 0n, 10);

      expect(rows).toHaveLength(2);
      const expectedSecond = sha256Hex(rows[0].hash + (await canonicalJson(rows[1].chainInput)));
      expect(rows[1].hash).toBe(expectedSecond);
    });

    it('keeps chains isolated per user (INV-9) — each starts from its own genesis', async () => {
      const { store, reader } = await makeFixture();
      // Distinct aggregate labels: `uuidFor` caches by label alone, so reusing
      // 'agg-1' for both users would collide on the real aggregate_id UNIQUE
      // constraint — a fixture bug, not a production scenario (real aggregate
      // ids are random UUIDs, never shared across users).
      const a = streamFor('user-1', 'agg-1');
      const b = streamFor('user-2', 'agg-2');

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const [rowA] = await reader.readChain(a.userId, 0n, 10);
      const [rowB] = await reader.readChain(b.userId, 0n, 10);

      // Both are genesis events (chain against ''), but their inputs differ
      // (different eventId/userId), so their hashes must differ too.
      expect(rowA.hash).not.toBe(rowB.hash);
    });

    it('serializes concurrent appends to different aggregates of the same user', async () => {
      const { store, reader } = await makeFixture();
      const a = streamFor('user-1', 'agg-a');
      const b = streamFor('user-1', 'agg-b');

      await Promise.all([
        store.append(a, 0, [anEnvelope(a, 1)]),
        store.append(b, 0, [anEnvelope(b, 1)]),
      ]);

      const rows = await reader.readChain(a.userId, 0n, 10);

      expect(rows).toHaveLength(2);
      // Exactly one chains against the empty genesis; the other chains
      // against the first — never both against '' (the G-3 race this
      // historia closes).
      const secondCanonical = await canonicalJson(rows[1].chainInput);
      expect(rows[1].hash).toBe(sha256Hex(rows[0].hash + secondCanonical));
    });

    it('userIds() lists every user with at least one chained event', async () => {
      const { store, reader } = await makeFixture();
      const a = streamFor('user-1', 'agg-1');
      const b = streamFor('user-2', 'agg-2');

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const ids = await reader.userIds();

      expect([...ids].sort()).toEqual([a.userId, b.userId].sort());
    });

    it('readChain pagination is exclusive on fromPosition (no skip, no repeat)', async () => {
      const { store, reader } = await makeFixture();
      const stream = streamFor('user-1', 'agg-1');

      await store.append(stream, 0, [anEnvelope(stream, 1), anEnvelope(stream, 2), anEnvelope(stream, 3)]);

      const firstPage = await reader.readChain(stream.userId, 0n, 2);
      const secondPage = await reader.readChain(stream.userId, firstPage[1].globalPosition, 2);

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
      // `global_position` is an autogenerated identity: the only reliable
      // "no gap, no repeat" assertion is strict ordering across the two
      // pages, not a specific numeric offset.
      expect(secondPage[0].globalPosition).toBeGreaterThan(firstPage[1].globalPosition);
    });
  });
}
