import { Criteria } from '@shared';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { InMemoryProjectionCheckpointRepository } from './in-memory-projection-checkpoint.repository';
import { PollingProjectionDispatcher } from './polling-dispatcher';
import { SynchronousProjectionDispatcher } from './synchronous-dispatcher';

/** Counts how many times each key has been seen, upsert-idempotent by key. */
class CountingProjector extends Projector {
  readonly name = 'counter';
  readonly consumes = ['Ticked'];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const key = (event.payload as { key: string }).key;
    await store.upsert('counts', { key }, { key, seen: 'yes' });
  }
}

function envelope(sequence: number, key: string): EventEnvelope {
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `e-${sequence}`,
    userId: 'user-1',
    aggregateType: 'Thing',
    aggregateId: 'thing-1',
    sequence,
    eventType: 'Ticked',
    schemaVersion: 1,
    clientId: 'c',
    externalRef: null,
    payload: { key },
    occurredAt: now,
    recordedAt: now,
  };
}

describe('PollingProjectionDispatcher', () => {
  it('produces the same read model as the synchronous path (same projector, both modes)', async () => {
    const syncStore = new InMemoryReadModelStore();
    const pollStore = new InMemoryReadModelStore();
    const eventStore = new InMemoryEventStore();

    await eventStore.append(
      { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'thing-1' },
      0,
      [envelope(1, 'a'), envelope(2, 'b')],
    );

    const events = await eventStore.readAll(0n, 100);

    await new SynchronousProjectionDispatcher([new CountingProjector()], syncStore).dispatch(events);

    const poller = new PollingProjectionDispatcher(
      'counter',
      eventStore,
      [new CountingProjector()],
      pollStore,
      new InMemoryProjectionCheckpointRepository(),
    );
    await poller.catchUp();

    const syncRows = await syncStore.query('counts', Criteria.none());
    const pollRows = await pollStore.query('counts', Criteria.none());

    expect(pollRows).toEqual(syncRows);
    expect(pollRows).toHaveLength(2);
  });

  it('advances the checkpoint and does not reprocess on a second poll', async () => {
    const store = new InMemoryReadModelStore();
    const eventStore = new InMemoryEventStore();
    await eventStore.append(
      { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'thing-1' },
      0,
      [envelope(1, 'a')],
    );

    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const poller = new PollingProjectionDispatcher(
      'counter',
      eventStore,
      [new CountingProjector()],
      store,
      checkpoints,
    );

    expect(await poller.pollOnce()).toBe(1);
    expect(await poller.pollOnce()).toBe(0);
    expect(await checkpoints.lastPosition('counter')).toBe(1n);
  });
});
