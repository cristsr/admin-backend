import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import {
  AdjustmentAuditProjector,
  PROJ_ADJUSTMENT_AUDIT,
  PROJ_ADJUSTMENT_AUDIT_ENTRIES,
} from './adjustment-audit.projector';
import { PROJ_ASSERTIONS } from './assertion-status.projector';

const AT = new Date('2026-07-22T10:00:00.000Z');

const resolvedEvent = (assertionId: string, adjustmentTxnId: string): StoredEvent =>
  ({
    eventId: `evt-${adjustmentTxnId}`,
    userId: 'user-1',
    aggregateType: 'BalanceAssertion',
    aggregateId: assertionId,
    sequence: 3,
    eventType: 'DiscrepancyResolved',
    schemaVersion: 1,
    clientId: 'client-1',
    externalRef: null,
    externalRefHash: null,
    payload: { assertionId, adjustmentTransactionId: adjustmentTxnId },
    occurredAt: AT,
    recordedAt: AT,
    globalPosition: 3n,
  }) as StoredEvent;

describe('AdjustmentAuditProjector', () => {
  let store: InMemoryReadModelStore;
  const projector = new AdjustmentAuditProjector(new SeedCurrencyCatalog());

  /** Seeds an evaluated assertion, which is what carries the adjusted amount. */
  const seedAssertion = async (
    assertionId: string,
    accountId: string,
    difference: string | null,
  ): Promise<void> => {
    await store.upsert(
      PROJ_ASSERTIONS,
      { assertion_id: assertionId },
      {
        assertion_id: assertionId,
        user_id: 'user-1',
        account_id: accountId,
        date: '2026-07-22',
        occurred_at: null,
        expected_amount: '1000',
        currency_code: 'USD',
        tolerance: '0',
        status: difference ? AssertionStatus.MISMATCHED : AssertionStatus.UNCHECKED,
        difference,
        resolved_by_txn: null,
        revoke_reason: null,
        checked_at: null,
        created_at: AT,
      },
    );
  };

  const summaryOf = async (accountId: string) =>
    store.query<Record<string, unknown>>(
      PROJ_ADJUSTMENT_AUDIT,
      Criteria.none().equals('user_id', 'user-1').equals('account_id', accountId),
    );

  const entriesOf = async () =>
    store.query<Record<string, unknown>>(PROJ_ADJUSTMENT_AUDIT_ENTRIES, Criteria.none());

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('declares the Projector contract', () => {
    expect(projector.name).toBe('adjustment_audit');
    expect(projector.consumes).toEqual(['DiscrepancyResolved']);
    expect(projector.handles('DiscrepancyResolved')).toBe(true);
    expect(projector.handles('BalanceAsserted')).toBe(false);
  });

  it('records the detail entry and the summary from the assertion difference', async () => {
    await seedAssertion('a-1', 'acc-1', '400');

    await projector.project(resolvedEvent('a-1', 'txn-9'), store);

    const [entry] = await entriesOf();
    expect(entry).toMatchObject({
      adjustment_txn_id: 'txn-9',
      user_id: 'user-1',
      account_id: 'acc-1',
      assertion_id: 'a-1',
      amount: '400',
      currency_code: 'USD',
      resolved_on: '2026-07-22',
    });

    const [summary] = await summaryOf('acc-1');
    expect(summary).toMatchObject({
      total_adjusted: '400',
      adjustment_count: 1,
      last_adjusted_on: '2026-07-22',
    });
  });

  it('sums several adjustments on the same account', async () => {
    await seedAssertion('a-1', 'acc-1', '400');
    await seedAssertion('a-2', 'acc-1', '100');

    await projector.project(resolvedEvent('a-1', 'txn-1'), store);
    await projector.project(resolvedEvent('a-2', 'txn-2'), store);

    const [summary] = await summaryOf('acc-1');
    expect(summary.total_adjusted).toBe('500');
    expect(summary.adjustment_count).toBe(2);
  });

  it('nets adjustments of opposite sign', async () => {
    await seedAssertion('a-1', 'acc-1', '400');
    await seedAssertion('a-2', 'acc-1', '-150');

    await projector.project(resolvedEvent('a-1', 'txn-1'), store);
    await projector.project(resolvedEvent('a-2', 'txn-2'), store);

    const [summary] = await summaryOf('acc-1');
    expect(summary.total_adjusted).toBe('250');
  });

  it('recalculates instead of incrementing, so a replay never double-counts', async () => {
    await seedAssertion('a-1', 'acc-1', '400');

    await projector.project(resolvedEvent('a-1', 'txn-9'), store);
    await projector.project(resolvedEvent('a-1', 'txn-9'), store);

    const [summary] = await summaryOf('acc-1');
    expect(summary.total_adjusted).toBe('400');
    expect(summary.adjustment_count).toBe(1);
  });

  it('ignores a resolution whose assertion was never projected', async () => {
    await projector.project(resolvedEvent('a-unknown', 'txn-9'), store);

    expect(await entriesOf()).toEqual([]);
  });

  it('ignores a resolution whose assertion has no difference', async () => {
    await seedAssertion('a-1', 'acc-1', null);

    await projector.project(resolvedEvent('a-1', 'txn-9'), store);

    expect(await entriesOf()).toEqual([]);
  });

  it('ignores events it does not consume', async () => {
    await seedAssertion('a-1', 'acc-1', '400');

    await projector.project(
      { ...resolvedEvent('a-1', 'txn-9'), eventType: 'BalanceAsserted' } as StoredEvent,
      store,
    );

    expect(await entriesOf()).toEqual([]);
  });

  it('keeps accounts apart', async () => {
    await seedAssertion('a-1', 'acc-1', '400');
    await seedAssertion('a-2', 'acc-2', '250');

    await projector.project(resolvedEvent('a-1', 'txn-1'), store);
    await projector.project(resolvedEvent('a-2', 'txn-2'), store);

    expect((await summaryOf('acc-1'))[0].total_adjusted).toBe('400');
    expect((await summaryOf('acc-2'))[0].total_adjusted).toBe('250');
  });
});
