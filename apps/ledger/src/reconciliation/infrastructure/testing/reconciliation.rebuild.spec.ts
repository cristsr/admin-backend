import { ProjectionRegistry } from '@cqrs/application/tooling/projection-registry';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryProjectionCheckpointRepository } from '@cqrs/infrastructure/adapters/projection/in-memory-projection-checkpoint.repository';
import { ProjectionRebuilder } from '@cqrs/infrastructure/adapters/projection/projection-rebuilder';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { RECONCILIATION_PROJECTION } from '@ledger/reconciliation/infrastructure/adapters/events/reconciliation.pump';
import {
  AdjustmentAuditProjector,
  PROJ_ADJUSTMENT_AUDIT,
  PROJ_ADJUSTMENT_AUDIT_ENTRIES,
} from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import {
  AssertionStatusProjector,
  PROJ_ASSERTIONS,
} from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';

const AT = new Date('2026-07-22T10:00:00.000Z');

/**
 * Rebuild of the reconciliation projections from the stream.
 * Registers both projectors under one projection name, the same way
 * `rebuild.command.ts` does, so the audit is always rebuilt against a current
 * `proj_assertions`.
 */
describe('Reconciliation projections rebuild', () => {
  let eventStore: InMemoryEventStore;
  let readModel: InMemoryReadModelStore;
  let rebuilder: ProjectionRebuilder;

  let sequence = 0;

  const append = async (
    assertionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    const stream: StreamId = {
      userId: 'user-1',
      aggregateType: 'BalanceAssertion',
      aggregateId: assertionId,
    };
    const version = (await eventStore.load(stream)).length;
    const envelope: EventEnvelope = {
      eventId: `evt-${assertionId}-${(sequence += 1)}`,
      userId: 'user-1',
      aggregateType: 'BalanceAssertion',
      aggregateId: assertionId,
      sequence: version + 1,
      eventType,
      schemaVersion: 1,
      clientId: 'client-1',
      externalRef: null,
      externalRefHash: null,
      payload,
      occurredAt: AT,
      recordedAt: AT,
    };

    await eventStore.append(stream, version, [envelope]);
  };

  const seedStream = async (): Promise<void> => {
    await append('a-1', 'BalanceAsserted', {
      accountId: 'acc-1',
      date: '2026-07-22',
      occurredAt: null,
      expectedAmount: '1000',
      currency: 'USD',
      tolerance: '0',
    });
    await append('a-1', 'BalanceAssertionEvaluated', {
      result: AssertionStatus.MISMATCHED,
      difference: '400',
      currency: 'USD',
      evaluatedAt: '2026-07-23T09:00:00.000Z',
    });
    await append('a-1', 'DiscrepancyResolved', {
      assertionId: 'a-1',
      adjustmentTransactionId: 'txn-9',
    });

    // A second, revoked assertion: a rebuild must not resurrect it as active.
    await append('a-2', 'BalanceAsserted', {
      accountId: 'acc-1',
      date: '2026-07-20',
      occurredAt: null,
      expectedAmount: '500',
      currency: 'USD',
      tolerance: '0',
    });
    await append('a-2', 'AssertionRevoked', { reason: 'wrong statement' });
  };

  const snapshot = async () => ({
    assertions: await readModel.query<Record<string, unknown>>(PROJ_ASSERTIONS, Criteria.none()),
    audit: await readModel.query<Record<string, unknown>>(PROJ_ADJUSTMENT_AUDIT, Criteria.none()),
    entries: await readModel.query<Record<string, unknown>>(
      PROJ_ADJUSTMENT_AUDIT_ENTRIES,
      Criteria.none(),
    ),
  });

  beforeEach(async () => {
    sequence = 0;
    eventStore = new InMemoryEventStore();
    readModel = new InMemoryReadModelStore();

    const registry = new ProjectionRegistry();
    registry.register(
      RECONCILIATION_PROJECTION,
      [new AssertionStatusProjector(), new AdjustmentAuditProjector(new SeedCurrencyCatalog())],
      [PROJ_ASSERTIONS, PROJ_ADJUSTMENT_AUDIT, PROJ_ADJUSTMENT_AUDIT_ENTRIES],
    );

    rebuilder = new ProjectionRebuilder(
      eventStore,
      readModel,
      new InMemoryProjectionCheckpointRepository(),
      registry,
    );

    await seedStream();
  });

  it('rebuilds both projections from an empty read model', async () => {
    const applied = await rebuilder.rebuild(RECONCILIATION_PROJECTION);

    expect(applied).toBe(5);

    const { assertions, audit, entries } = await snapshot();
    expect(assertions).toHaveLength(2);
    expect(audit).toHaveLength(1);
    expect(entries).toHaveLength(1);
  });

  it('reproduces the resolved assertion with its verdict and adjustment link', async () => {
    await rebuilder.rebuild(RECONCILIATION_PROJECTION);

    const [resolved] = await readModel.query<Record<string, unknown>>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('assertion_id', 'a-1'),
    );
    expect(resolved.status).toBe(AssertionStatus.MISMATCHED);
    expect(resolved.difference).toBe('400');
    expect(resolved.resolved_by_txn).toBe('txn-9');

    const [audited] = await readModel.query<Record<string, unknown>>(
      PROJ_ADJUSTMENT_AUDIT,
      Criteria.none().equals('account_id', 'acc-1'),
    );
    expect(audited.total_adjusted).toBe('400');
    expect(audited.adjustment_count).toBe(1);
  });

  it('keeps a revoked assertion revoked after the rebuild', async () => {
    await rebuilder.rebuild(RECONCILIATION_PROJECTION);

    const [revoked] = await readModel.query<Record<string, unknown>>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('assertion_id', 'a-2'),
    );
    expect(revoked.status).toBe(AssertionStatus.REVOKED);
    expect(revoked.revoke_reason).toBe('wrong statement');
  });

  it('is idempotent: a second rebuild yields the identical state', async () => {
    await rebuilder.rebuild(RECONCILIATION_PROJECTION);
    const first = await snapshot();

    await rebuilder.rebuild(RECONCILIATION_PROJECTION);
    const second = await snapshot();

    expect(second.assertions).toEqual(first.assertions);
    expect(second.entries).toEqual(first.entries);
    // updated_at is a wall-clock stamp, so compare the accounting columns
    expect(second.audit[0].total_adjusted).toBe(first.audit[0].total_adjusted);
    expect(second.audit[0].adjustment_count).toBe(first.audit[0].adjustment_count);
  });

  it('rebuilds from a dirty read model, dropping rows the stream no longer justifies', async () => {
    await readModel.upsert(
      PROJ_ASSERTIONS,
      { assertion_id: 'stale' },
      { assertion_id: 'stale', user_id: 'user-1', account_id: 'acc-9', status: 'MATCHED' },
    );

    await rebuilder.rebuild(RECONCILIATION_PROJECTION);

    const ids = (await snapshot()).assertions.map((row) => row.assertion_id);
    expect(ids).not.toContain('stale');
    expect(ids).toEqual(expect.arrayContaining(['a-1', 'a-2']));
  });
});
