import { FixedClock, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransfersMerged } from './events';
import {
  ImmutableTransactionException,
  InsufficientPostingsException,
  InvalidTransactionStateException,
} from './exceptions/transaction.exception';
import { LedgerTransaction, RecordTransactionArgs } from './ledger-transaction.aggregate';
import { TransactionStatus } from './transaction-status';

const balance = new ZeroSumBalanceRule();
const idGen = new SequentialIdGenerator();
const clock = new FixedClock(new Date('2026-07-22T12:00:00.000Z'));

function balancedPostings(): PostingLine[] {
  return [
    PostingLine.of({ accountId: 'expenses', amount: aMoney().of('31900').inCop(), metadata: {} }),
    PostingLine.of({ accountId: 'assets', amount: aMoney().of('-31900').inCop(), metadata: {} }),
  ];
}

function recordArgs(overrides: Partial<RecordTransactionArgs> = {}): RecordTransactionArgs {
  return {
    date: LedgerDate.of('2026-07-20'),
    payee: null,
    description: 'Netflix',
    postings: balancedPostings(),
    initialStatus: TransactionStatus.PENDING,
    invoiceUrl: null,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

describe('LedgerTransaction', () => {
  it('records a balanced transaction', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);

    expect(tx.status).toBe(TransactionStatus.PENDING);
    expect(tx.postings).toHaveLength(2);
  });

  it('rejects fewer than two postings (INV-2)', () => {
    const single = [balancedPostings()[0]];

    expect(() => LedgerTransaction.record(recordArgs({ postings: single }), balance, idGen)).toThrow(
      InsufficientPostingsException,
    );
  });

  it('records directly as CONFIRMED (RF-3)', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );

    expect(tx.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('amends while PENDING and re-balances', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);
    tx.pullChanges();

    tx.amend(balancedPostings(), LedgerDate.of('2026-07-21'), balance);

    expect(tx.date.value).toBe('2026-07-21');
  });

  it('rejects amendment once CONFIRMED (INV-6)', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();

    expect(() => tx.amend(balancedPostings(), LedgerDate.of('2026-07-21'), balance)).toThrow(
      ImmutableTransactionException,
    );
  });

  it('annotates PENDING and CONFIRMED but not VOIDED (INV-6)', () => {
    const confirmed = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    confirmed.pullChanges();

    expect(() =>
      confirmed.annotate({
        payee: 'Netflix',
        description: 'Sub',
        invoiceUrl: null,
        tags: ['x'],
        metadata: {},
      }),
    ).not.toThrow();

    const voided = LedgerTransaction.record(recordArgs(), balance, idGen);
    voided.void('duplicate');

    expect(() =>
      voided.annotate({
        payee: null,
        description: 'x',
        invoiceUrl: null,
        tags: [],
        metadata: {},
      }),
    ).toThrow(InvalidTransactionStateException);
  });

  it('confirms PENDING once and rejects double confirmation', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);
    tx.confirm(clock);

    expect(tx.status).toBe(TransactionStatus.CONFIRMED);
    expect(() => tx.confirm(clock)).toThrow(InvalidTransactionStateException);
  });

  it('voids only PENDING transactions', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );

    expect(() => tx.void('nope')).toThrow(InvalidTransactionStateException);
  });

  it('reverses a CONFIRMED transaction and returns an inverted plan', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();

    const plan = tx.reverse('rev-1');

    expect(plan.reversalId).toBe('rev-1');
    expect(plan.sourceTransactionId).toBe(tx.id);
    expect(plan.postings[0].amount.toDecimalString()).toBe('-31900');
    expect(plan.postings[1].amount.toDecimalString()).toBe('31900');
  });

  it('does not reverse a PENDING transaction', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);

    expect(() => tx.reverse('rev-1')).toThrow(InvalidTransactionStateException);
  });

  it('records the merge fact on the resulting confirmed transfer (RF-16, §3.4)', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();

    tx.mergedFrom(['leg-1', 'leg-2']);
    const [event] = tx.pullChanges();

    expect(event).toBeInstanceOf(TransfersMerged);
    expect((event as TransfersMerged).props.mergedTransactionIds).toEqual(['leg-1', 'leg-2']);
    expect((event as TransfersMerged).props.postings).toEqual(tx.postings);
    // The merge fact adds no lifecycle state of its own.
    expect(tx.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('refuses to record a merge on a transfer that is not CONFIRMED (RF-16)', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);

    expect(() => tx.mergedFrom(['leg-1', 'leg-2'])).toThrow(InvalidTransactionStateException);
  });

  it('rehydrates a merged transfer without losing its state', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.mergedFrom(['leg-1', 'leg-2']);
    const events = tx.pullChanges();

    const rebuilt = LedgerTransaction.rehydrate(tx.id, [...events]);

    expect(rebuilt.status).toBe(TransactionStatus.CONFIRMED);
    expect(rebuilt.version).toBe(2);
  });

  it('rehydrates the full lifecycle from history', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);
    tx.confirm(clock);
    const events = tx.pullChanges();

    const rebuilt = LedgerTransaction.rehydrate(tx.id, [...events]);

    expect(rebuilt.status).toBe(TransactionStatus.CONFIRMED);
    expect(rebuilt.version).toBe(2);
  });
});
