import { Criteria } from '@shared';
import { ReevaluateAssertionsReactor } from '@ledger/reconciliation/application/reactors/reevaluate-assertions.reactor';
import { AdjustmentAuditProjector } from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import {
  AssertionStatusProjector,
  PROJ_ASSERTIONS,
} from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryProjectionCheckpointRepository } from '@ledger/shared-kernel/infrastructure/adapters/projection/in-memory-projection-checkpoint.repository';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { RECONCILIATION_PROJECTION, ReconciliationPump } from './reconciliation.pump';

const AT = new Date('2026-07-22T10:00:00.000Z');

describe('ReconciliationPump', () => {
  let eventStore: InMemoryEventStore;
  let readModel: InMemoryReadModelStore;
  let checkpoints: InMemoryProjectionCheckpointRepository;
  let reactor: jest.Mocked<ReevaluateAssertionsReactor>;
  let pump: ReconciliationPump;

  const appendAsserted = async (assertionId: string): Promise<void> => {
    const stream: StreamId = {
      userId: 'user-1',
      aggregateType: 'BalanceAssertion',
      aggregateId: assertionId,
    };
    const envelope: EventEnvelope = {
      eventId: `evt-${assertionId}`,
      userId: 'user-1',
      aggregateType: 'BalanceAssertion',
      aggregateId: assertionId,
      sequence: 1,
      eventType: 'BalanceAsserted',
      schemaVersion: 1,
      clientId: 'client-1',
      externalRef: null,
      payload: {
        accountId: 'acc-1',
        date: '2026-07-22',
        occurredAt: null,
        expectedAmount: '1000',
        currency: 'USD',
        tolerance: '0',
      },
      occurredAt: AT,
      recordedAt: AT,
    };

    await eventStore.append(stream, 0, [envelope]);
  };

  const projectedIds = async (): Promise<string[]> => {
    const rows = await readModel.query<Record<string, unknown>>(PROJ_ASSERTIONS, Criteria.none());

    return rows.map((row) => row.assertion_id as string);
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    readModel = new InMemoryReadModelStore();
    checkpoints = new InMemoryProjectionCheckpointRepository();
    reactor = { on: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ReevaluateAssertionsReactor>;

    pump = new ReconciliationPump(
      eventStore,
      readModel,
      checkpoints,
      reactor,
      new AssertionStatusProjector(),
      new AdjustmentAuditProjector(new SeedCurrencyCatalog()),
    );
  });

  it('projects every event and advances the persisted checkpoint', async () => {
    await appendAsserted('a-1');
    await appendAsserted('a-2');

    await pump.pump();

    expect(await projectedIds()).toEqual(expect.arrayContaining(['a-1', 'a-2']));
    expect(await checkpoints.lastPosition(RECONCILIATION_PROJECTION)).toBeGreaterThan(0n);
  });

  it('feeds the reactor after projecting, once per event', async () => {
    await appendAsserted('a-1');

    await pump.pump();

    expect(reactor.on).toHaveBeenCalledTimes(1);
  });

  it('resumes from the persisted checkpoint instead of replaying the stream', async () => {
    await appendAsserted('a-1');
    await pump.pump();
    const afterFirst = await checkpoints.lastPosition(RECONCILIATION_PROJECTION);
    reactor.on.mockClear();

    await pump.pump();

    expect(reactor.on).not.toHaveBeenCalled();
    expect(await checkpoints.lastPosition(RECONCILIATION_PROJECTION)).toBe(afterFirst);
  });

  it('picks up only the new events on a later run', async () => {
    await appendAsserted('a-1');
    await pump.pump();
    reactor.on.mockClear();

    await appendAsserted('a-2');
    await pump.pump();

    expect(reactor.on).toHaveBeenCalledTimes(1);
    expect(await projectedIds()).toEqual(expect.arrayContaining(['a-1', 'a-2']));
  });

  it('does not advance the checkpoint past a failing event', async () => {
    await appendAsserted('a-1');
    reactor.on.mockRejectedValueOnce(new Error('reactor down'));

    await expect(pump.pump()).rejects.toThrow('reactor down');

    expect(await checkpoints.lastPosition(RECONCILIATION_PROJECTION)).toBe(0n);
  });

  it('retries the failed event on the next run', async () => {
    await appendAsserted('a-1');
    reactor.on.mockRejectedValueOnce(new Error('transient'));
    await expect(pump.pump()).rejects.toThrow('transient');

    await pump.pump();

    expect(await projectedIds()).toEqual(['a-1']);
    expect(await checkpoints.lastPosition(RECONCILIATION_PROJECTION)).toBeGreaterThan(0n);
  });

  it('swallows the failure in the scheduled drain so the interval keeps ticking', async () => {
    await appendAsserted('a-1');
    reactor.on.mockRejectedValueOnce(new Error('transient'));

    await expect(pump.drain()).resolves.toBeUndefined();

    // the next tick succeeds
    await pump.drain();
    expect(await projectedIds()).toEqual(['a-1']);
  });
});
