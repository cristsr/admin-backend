import { RecordingCommandBus } from '@ledger/shared/testing';
import { aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import { AccountFacts, AccountLookup } from '@ledger/transactions/domain/ports/account-lookup.port';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransferPairRule } from '@ledger/transactions/domain/services/transfer-pair.rule';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { LedgerTransactionRepository } from '../ledger-transaction.repository';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';
import { MergePendingTransfersHandler } from './merge-pending-transfers.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'merge-ref' };

/** A stand-in aggregate exposing only what the handler reads. */
function aPendingTransaction(accountId: string, amount: string, status = TransactionStatus.PENDING) {
  return {
    status,
    date: LedgerDate.of('2026-07-20'),
    postings: [
      PostingLine.of({ accountId, amount: aMoney().of(amount).inUsd(), metadata: {} }),
      PostingLine.of({
        accountId: 'acc-expenses',
        amount: aMoney().of(amount).inUsd().negate(),
        metadata: {},
      }),
    ],
  };
}

/** A stand-in for the transfer the merge records, ready to carry the merge fact. */
function aRecordedTransfer() {
  return { mergedFrom: jest.fn() };
}

function setup(accountTypes: Record<string, string> = { 'acc-out': 'ASSETS', 'acc-in': 'ASSETS' }) {
  const transactions = {
    load: jest.fn(),
    save: jest.fn().mockResolvedValue({ events: [], version: 2, lastPosition: 2n }),
    externalRefOf: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const accounts: jest.Mocked<AccountLookup> = {
    factsOf: jest.fn(async (_userId: string, accountId: string) => {
      const type = accountTypes[accountId];

      return type
        ? ({ accountId, type, currency: 'USD', isBankMirror: false } as AccountFacts)
        : null;
    }),
  };

  const bus = new RecordingCommandBus('transfer-txn-1');
  // The scope just runs the work here; the rollback semantics live in the event
  // store contract, which both adapters satisfy.
  const eventStore = {
    withTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
  } as unknown as EventStore;
  const handler = new MergePendingTransfersHandler(
    transactions,
    accounts,
    new TransferPairRule(),
    bus,
    eventStore,
  );

  return { handler, transactions, bus };
}

/** Seeds a mergeable pair plus the transfer the handler loads back afterwards. */
function seedMergeablePair(
  transactions: jest.Mocked<LedgerTransactionRepository>,
  transfer = aRecordedTransfer(),
) {
  transactions.load
    .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
    .mockResolvedValueOnce(aPendingTransaction('acc-in', '500') as never)
    .mockResolvedValueOnce(transfer as never);

  return transfer;
}

describe('MergePendingTransfersHandler', () => {
  it('voids both legs and records a single confirmed transfer', async () => {
    const { handler, transactions, bus } = setup();
    seedMergeablePair(transactions);

    const result = await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    expect(bus.dispatchedOf(VoidPendingTransactionCommand)).toHaveLength(2);

    const records = bus.dispatchedOf(RecordTransactionCommand);
    expect(records).toHaveLength(1);
    expect(records[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-out', amount: '-500' }),
      expect.objectContaining({ accountId: 'acc-in', amount: '500' }),
    ]);
    expect(records[0].date).toBe('2026-07-20');
    expect(records[0].metadata).toMatchObject({ merged_from: 't1,t2' });
    // The transfer is the idempotency anchor, so it is what the result names.
    expect(result.aggregateId).toBe('transfer-txn-1');

    // The transfer is recorded directly CONFIRMED; no separate confirm dispatch.
    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(0);
  });

  it("preserves both legs' external references in metadata (RF-16)", async () => {
    const { handler, transactions, bus } = setup();
    seedMergeablePair(transactions);
    transactions.externalRefOf.mockImplementation(async (_userId, id) =>
      ({ t1: 'bank-tx-aaa', t2: 'bank-tx-bbb' })[id] ?? null,
    );

    await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    const [record] = bus.dispatchedOf(RecordTransactionCommand);
    expect(record.metadata).toEqual({
      merged_from: 't1,t2',
      merged_external_refs: 'bank-tx-aaa,bank-tx-bbb',
    });
  });

  it('keeps the positional slot of a leg with no external reference (RF-16)', async () => {
    const { handler, transactions, bus } = setup();
    seedMergeablePair(transactions);
    transactions.externalRefOf.mockImplementation(async (_userId, id) =>
      id === 't2' ? 'bank-tx-bbb' : null,
    );

    await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    const [record] = bus.dispatchedOf(RecordTransactionCommand);
    expect(record.metadata.merged_external_refs).toBe(',bank-tx-bbb');
  });

  it('omits the external references when neither leg carries one (RF-16)', async () => {
    const { handler, transactions, bus } = setup();
    seedMergeablePair(transactions);

    await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    const [record] = bus.dispatchedOf(RecordTransactionCommand);
    expect(record.metadata).toEqual({ merged_from: 't1,t2' });
  });

  it('emits TransfersMerged on the resulting transfer (§3.4)', async () => {
    const { handler, transactions } = setup();
    const transfer = seedMergeablePair(transactions);

    await handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);

    expect(transfer.mergedFrom).toHaveBeenCalledWith(['t1', 't2']);
    // Appended without stamping the external_ref again: the recorded transfer
    // is already the command's idempotency anchor.
    expect(transactions.save).toHaveBeenCalledWith(transfer, { ...ctx, externalRef: null });
  });

  it('rejects when a referenced transaction does not exist', async () => {
    const { handler, transactions } = setup();
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(null as never);

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(PendingLegNotFoundException);
  });

  it('rejects when a referenced transaction is no longer pending', async () => {
    const { handler, transactions } = setup();
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(
        aPendingTransaction('acc-in', '500', TransactionStatus.CONFIRMED) as never,
      );

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(PendingLegNotFoundException);
  });

  it('rejects two legs that are not a transfer pair (same sign)', async () => {
    const { handler, transactions } = setup();
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(aPendingTransaction('acc-in', '-500') as never);

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(NotATransferPairException);
  });

  it('rejects a leg with no real-account posting', async () => {
    const { handler, transactions } = setup({ 'acc-in': 'ASSETS' });
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(aPendingTransaction('acc-in', '500') as never);

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(NotATransferPairException);
  });

  it('rejects a leg whose postings both hit real accounts', async () => {
    const { handler, transactions } = setup({
      'acc-out': 'ASSETS',
      'acc-in': 'ASSETS',
      'acc-expenses': 'LIABILITIES',
    });
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(aPendingTransaction('acc-in', '500') as never);

    await expect(
      handler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx),
    ).rejects.toBeInstanceOf(NotATransferPairException);
  });
});
