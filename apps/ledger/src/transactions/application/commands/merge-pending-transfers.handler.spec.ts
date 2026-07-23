import {
  AuthenticatedContext,
  ConfirmTransactionCommand,
  RecordTransactionCommand,
  VoidPendingTransactionCommand,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { FakeCommandBus, SequentialIdGenerator } from '@ledger/shared/testing';
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
  const context = new AuthenticatedContext('user-1', 'client-1');

  let store: InMemoryTransferCandidateStore;
  let bus: FakeCommandBus;
  let handler: MergePendingTransfersHandler;

  beforeEach(() => {
    store = new InMemoryTransferCandidateStore();
    bus = new FakeCommandBus();
    handler = new MergePendingTransfersHandler(
      store,
      new TransferDetector({ windowDays: 3, amountTolerance: '0' }),
      bus,
      new SequentialIdGenerator(),
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

  it('voids both legs and records+confirms a single transfer preserving external refs', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't2', accountId: 'acc-in', amount: '500' }));

    await handler.execute(new MergePendingTransfersCommand(context, 'merge-ref', ['t1', 't2']));

    expect(bus.dispatchedOf(VoidPendingTransactionCommand)).toHaveLength(2);

    const records = bus.dispatchedOf(RecordTransactionCommand);
    expect(records).toHaveLength(1);
    expect(records[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-out', amount: '-500' }),
      expect.objectContaining({ accountId: 'acc-in', amount: '500' }),
    ]);
    expect(records[0].metadata).toMatchObject({ merged_external_refs: ['ref-t1', 'ref-t2'] });

    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(1);
  });

  it('rejects when a referenced leg is not pending', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));

    await expect(
      handler.execute(new MergePendingTransfersCommand(context, null, ['t1', 't2'])),
    ).rejects.toBeInstanceOf(PendingLegNotFoundException);
  });

  it('rejects two legs that are not a transfer pair (same sign)', async () => {
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't1', accountId: 'acc-out', amount: '-500' }));
    await store.upsertPendingLeg(pendingLeg({ transactionId: 't2', accountId: 'acc-in', amount: '-500' }));

    await expect(
      handler.execute(new MergePendingTransfersCommand(context, null, ['t1', 't2'])),
    ).rejects.toBeInstanceOf(NotATransferPairException);
  });
});
