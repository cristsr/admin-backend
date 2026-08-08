import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AssertionStatusProjector, PROJ_ASSERTIONS } from './assertion-status.projector';

const AT = new Date('2026-07-22T10:00:00.000Z');

const anEvent = (eventType: string, payload: Record<string, unknown>): StoredEvent =>
  ({
    eventId: `evt-${eventType}`,
    userId: 'user-1',
    aggregateType: 'BalanceAssertion',
    aggregateId: 'a-1',
    sequence: 1,
    eventType,
    schemaVersion: 1,
    clientId: 'client-1',
    externalRef: null,
    payload,
    occurredAt: AT,
    recordedAt: AT,
    globalPosition: 1n,
  }) as StoredEvent;

const asserted = anEvent('BalanceAsserted', {
  accountId: 'acc-1',
  date: '2026-07-22',
  occurredAt: null,
  expectedAmount: '1000',
  currency: 'USD',
  tolerance: '0',
});

describe('AssertionStatusProjector', () => {
  let store: InMemoryReadModelStore;
  const projector = new AssertionStatusProjector();

  const rowOf = async (assertionId: string) => {
    const rows = await store.query<Record<string, unknown>>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('assertion_id', assertionId),
    );

    return rows[0];
  };

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('declares the Projector contract', () => {
    expect(projector.name).toBe('assertion_status');
    expect(projector.consumes).toEqual([
      'BalanceAsserted',
      'BalanceAssertionEvaluated',
      'AssertionRevoked',
      'DiscrepancyResolved',
    ]);
    expect(projector.handles('BalanceAsserted')).toBe(true);
    expect(projector.handles('TransactionRecorded')).toBe(false);
  });

  it('inserts the row as UNCHECKED on BalanceAsserted', async () => {
    await projector.project(asserted, store);

    const row = await rowOf('a-1');
    expect(row).toMatchObject({
      assertion_id: 'a-1',
      user_id: 'user-1',
      account_id: 'acc-1',
      date: '2026-07-22',
      expected_amount: '1000',
      currency_code: 'USD',
      tolerance: '0',
      status: AssertionStatus.UNCHECKED,
      difference: null,
      resolved_by_txn: null,
      revoke_reason: null,
      checked_at: null,
    });
  });

  it('applies the verdict on BalanceAssertionEvaluated without losing the other columns', async () => {
    await projector.project(asserted, store);
    await projector.project(
      anEvent('BalanceAssertionEvaluated', {
        result: AssertionStatus.MISMATCHED,
        difference: '400',
        currency: 'USD',
        evaluatedAt: '2026-07-23T09:00:00.000Z',
      }),
      store,
    );

    const row = await rowOf('a-1');
    expect(row.status).toBe(AssertionStatus.MISMATCHED);
    expect(row.difference).toBe('400');
    expect(row.checked_at).toEqual(new Date('2026-07-23T09:00:00.000Z'));
    // the row survives whole: a partial write would have dropped these
    expect(row.account_id).toBe('acc-1');
    expect(row.expected_amount).toBe('1000');
  });

  it('marks REVOKED with its reason on AssertionRevoked', async () => {
    await projector.project(asserted, store);
    await projector.project(anEvent('AssertionRevoked', { reason: 'wrong statement' }), store);

    const row = await rowOf('a-1');
    expect(row.status).toBe(AssertionStatus.REVOKED);
    expect(row.revoke_reason).toBe('wrong statement');
    expect(row.account_id).toBe('acc-1');
  });

  it('links the adjustment transaction on DiscrepancyResolved', async () => {
    await projector.project(asserted, store);
    await projector.project(
      anEvent('DiscrepancyResolved', { assertionId: 'a-1', adjustmentTransactionId: 'txn-9' }),
      store,
    );

    const row = await rowOf('a-1');
    expect(row.resolved_by_txn).toBe('txn-9');
  });

  it('ignores an event that is not its own', async () => {
    await projector.project(anEvent('TransactionRecorded', {}), store);

    expect(await rowOf('a-1')).toBeUndefined();
  });

  it('ignores a follow-up event whose assertion was never projected', async () => {
    await projector.project(anEvent('AssertionRevoked', { reason: 'orphan' }), store);

    expect(await rowOf('a-1')).toBeUndefined();
  });

  it('is idempotent: replaying the same events leaves the same row', async () => {
    const evaluated = anEvent('BalanceAssertionEvaluated', {
      result: AssertionStatus.MATCHED,
      difference: '0',
      currency: 'USD',
      evaluatedAt: '2026-07-23T09:00:00.000Z',
    });

    await projector.project(asserted, store);
    await projector.project(evaluated, store);
    const first = await rowOf('a-1');

    await projector.project(asserted, store);
    await projector.project(evaluated, store);

    expect(await rowOf('a-1')).toEqual(first);
  });
});
