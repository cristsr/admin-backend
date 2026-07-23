import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  DISCREPANCY_RESOLVED,
  DiscrepancyResolved,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import { InMemoryAdjustmentAuditStore } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-adjustment-audit-store';
import { InMemoryAssertionStatusStore } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { DomainEvent } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { AdjustmentAuditProjector } from './adjustment-audit.projector';

describe('AdjustmentAuditProjector', () => {
  let audit: InMemoryAdjustmentAuditStore;
  let status: InMemoryAssertionStatusStore;
  let projector: AdjustmentAuditProjector;

  beforeEach(() => {
    audit = new InMemoryAdjustmentAuditStore();
    status = new InMemoryAssertionStatusStore();
    projector = new AdjustmentAuditProjector(audit, status);
  });

  const seedResolvedAssertion = async (
    assertionId: string,
    difference: string,
  ): Promise<void> => {
    await status.upsertAsserted({
      assertionId,
      userId: 'user-1',
      accountId: 'acc-1',
      date: '2026-07-22',
      occurredAt: null,
      expectedAmount: '1000',
      currencyCode: 'USD',
      tolerance: '0',
      status: AssertionStatus.MISMATCHED,
      difference: null,
      resolvedByTxn: null,
      revokeReason: null,
      checkedAt: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
    });
    await status.applyEvaluation(assertionId, AssertionStatus.MISMATCHED, difference, new Date());
  };

  const resolvedEvent = (assertionId: string, adjustmentTxnId: string): DomainEvent =>
    new DomainEvent(
      DISCREPANCY_RESOLVED,
      assertionId,
      'BalanceAssertion',
      3,
      'user-1',
      'client-1',
      null,
      new Date('2026-07-22T10:00:00.000Z'),
      new DiscrepancyResolved(assertionId, adjustmentTxnId),
    );

  it('accumulates total and count across resolutions on the same account', async () => {
    await seedResolvedAssertion('assert-1', '400');
    await seedResolvedAssertion('assert-2', '100');

    await projector.project(resolvedEvent('assert-1', 'adj-1'));
    await projector.project(resolvedEvent('assert-2', 'adj-2'));

    const [row] = await audit.byAccount('user-1', 'acc-1');
    expect(row.totalAdjusted).toBe('500');
    expect(row.adjustmentCount).toBe(2);
  });

  it('ignores non-resolution events (guard)', async () => {
    await projector.project(
      new DomainEvent('TransactionRecorded', 'txn-1', 'LedgerTransaction', 1, 'user-1', 'client-1', null, new Date(), {}),
    );

    expect(await audit.byAccount('user-1', 'acc-1')).toHaveLength(0);
  });

  it('is idempotent on replay of the same resolution', async () => {
    await seedResolvedAssertion('assert-1', '400');

    await projector.project(resolvedEvent('assert-1', 'adj-1'));
    await projector.project(resolvedEvent('assert-1', 'adj-1'));

    const [row] = await audit.byAccount('user-1', 'acc-1');
    expect(row.totalAdjusted).toBe('400');
    expect(row.adjustmentCount).toBe(1);
  });
});
