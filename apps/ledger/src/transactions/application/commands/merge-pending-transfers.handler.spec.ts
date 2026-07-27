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

function setup(accountTypes: Record<string, string> = { 'acc-out': 'ASSETS', 'acc-in': 'ASSETS' }) {
  const transactions = { load: jest.fn(), save: jest.fn() } as unknown as jest.Mocked<
    LedgerTransactionRepository
  >;

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

describe('MergePendingTransfersHandler', () => {
  it('voids both legs and records a single confirmed transfer', async () => {
    const { handler, transactions, bus } = setup();
    transactions.load
      .mockResolvedValueOnce(aPendingTransaction('acc-out', '-500') as never)
      .mockResolvedValueOnce(aPendingTransaction('acc-in', '500') as never);

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
    expect(result.transferTransactionId).toBe('transfer-txn-1');
    expect(result.voidedTransactionIds).toEqual(['t1', 't2']);

    // The transfer is recorded directly CONFIRMED; no separate confirm dispatch.
    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(0);
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
