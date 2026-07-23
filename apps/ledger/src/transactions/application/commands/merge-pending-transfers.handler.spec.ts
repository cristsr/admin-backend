import { RecordingCommandBus } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import { PendingLegRow } from '@ledger/transactions/domain/ports/transfer-candidate-store.port';
import { TransferDetector } from '@ledger/transactions/domain/services/transfer-detector.service';
import { InMemoryTransferCandidateStore } from '@ledger/transactions/infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';
import { MergePendingTransfersHandler } from './merge-pending-transfers.handler';

describe('MergePendingTransfersHandler', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'merge-ref' };

  let store: InMemoryTransferCandidateStore;
  let bus: RecordingCommandBus;
  let handler: MergePendingTransfersHandler;

  beforeEach(() => {
    store = new InMemoryTransferCandidateStore();
    bus = new RecordingCommandBus('transfer-txn-1');
    handler = new MergePendingTransfersHandler(
      store,
      new TransferDetector({ windowDays: 3, amountTolerance: '0' }),
      bus,
      new SeedCurrencyCatalog(),
    );
  });

  const pendingLeg = (overrides: Partial<PendingLegRow> & { transactionId: string; amount: string }): PendingLegRow => ({
    userId: 'user-1',
    accountId: 'acc-out',
    currencyCode: 'USD',
    date: '2026-07-20',
    isRealAccount: true,
    externalRef: `ref-${overrides.transactionId}`,
    ...overrides,
  });

  it('voids both legs and records a single confirmed transfer preserving external refs', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't2', accountId: 'acc-in', amount: '500' }));

    await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    expect(bus.dispatchedOf(VoidPendingTransactionCommand)).toHaveLength(2);

    const records = bus.dispatchedOf(RecordTransactionCommand);
    expect(records).toHaveLength(1);
    expect(records[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-out', amount: '-500' }),
      expect.objectContaining({ accountId: 'acc-in', amount: '500' }),
    ]);
    expect(records[0].metadata).toMatchObject({ merged_external_refs: 'ref-t1,ref-t2' });

    // The transfer is recorded directly CONFIRMED; no separate confirm dispatch.
    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(0);
  });

  it('rejects when a referenced leg is not pending', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(PendingLegNotFoundException);
  });

  it('rejects two legs that are not a transfer pair (same sign)', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't2', accountId: 'acc-in', amount: '-500' }));

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(NotATransferPairException);
  });
});
