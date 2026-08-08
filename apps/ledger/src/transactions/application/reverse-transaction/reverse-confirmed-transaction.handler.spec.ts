import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import {
  ImmutableTransactionException,
  TransactionNotFoundException,
} from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ReverseConfirmedTransactionCommand } from './reverse-confirmed-transaction.command';
import { ReverseConfirmedTransactionHandler } from './reverse-confirmed-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'rev-ref' };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const balance = {
    ensureBalanced: jest.fn(),
  } as unknown as jest.Mocked<BalanceRule>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('rev-id-1') };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
  // The scope just runs the work here; the rollback semantics live in the event
  // store contract, which both adapters satisfy — exercised below over the
  // in-memory store.
  const eventStore = {
    withTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
  } as unknown as EventStore;

  const handler = new ReverseConfirmedTransactionHandler(
    transactions,
    balance,
    idGenerator,
    dispatcher,
    eventStore,
  );

  return { handler, transactions, dispatcher };
}

function makeTransaction(id: string) {
  return {
    id,
    date: { value: '2026-07-20' },
    postings: [
      {
        accountId: 'acc-1',
        amount: '50000',
        negated: () => ({ accountId: 'acc-1', amount: '-50000' }),
      },
      {
        accountId: 'acc-2',
        amount: '-50000',
        negated: () => ({ accountId: 'acc-2', amount: '50000' }),
      },
    ],
    reverse: jest.fn(),
  };
}

describe('ReverseConfirmedTransactionHandler', () => {
  it('should reverse a CONFIRMED transaction and return reversing id', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as never);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 8n });

    const result = await handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx);

    expect(result.aggregateId).toBe('rev-id-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.reverse).toHaveBeenCalledWith('rev-id-1');
    expect(transactions.save).toHaveBeenCalledTimes(2);
  });

  it('should throw TransactionNotFoundException for non-existent transaction', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('non-existent'), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should propagate IMMUTABLE_TRANSACTION when aggregate rejects reversal', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.reverse.mockImplementation(() => {
      throw new ImmutableTransactionException('Not confirmed');
    });
    transactions.load.mockResolvedValue(tx as never);

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx),
    ).rejects.toBeInstanceOf(ImmutableTransactionException);
  });

  it('should save the original with externalRef and reversing without', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as never);
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx);

    expect(transactions.save).toHaveBeenNthCalledWith(1, expect.anything(), ctx);
    expect(transactions.save).toHaveBeenNthCalledWith(2, expect.anything(), {
      ...ctx,
      externalRef: null,
    });
  });

  it('projects only after both streams committed', async () => {
    const { handler, transactions, dispatcher } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as never);
    transactions.save
      .mockResolvedValueOnce({ events: [], version: 1, lastPosition: 1n })
      .mockRejectedValueOnce(new Error('reversing append failed'));

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx),
    ).rejects.toThrow('reversing append failed');

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});

/**
 * Cross-stream atomicity over the real event store (INV-7): the
 * original and the reversing transaction are two different streams, so a
 * failure between the two appends must leave neither behind.
 */
describe('ReverseConfirmedTransactionHandler (cross-stream atomicity)', () => {
  const catalog = new SeedCurrencyCatalog();
  const balanceRule = new ZeroSumBalanceRule();

  let eventStore: InMemoryEventStore;
  let transactions: LedgerTransactionRepository;
  let ids: IdGenerator;
  let handler: ReverseConfirmedTransactionHandler;

  /** Seeds one CONFIRMED transaction and returns its id. */
  const recordConfirmed = async (): Promise<string> => {
    const transaction = LedgerTransaction.record(
      {
        date: LedgerDate.of('2026-07-20'),
        payee: null,
        description: 'groceries',
        postings: [
          PostingLine.of({
            accountId: 'acc-assets',
            amount: aMoney().of('-500').inUsd(),
            metadata: {},
          }),
          PostingLine.of({
            accountId: 'acc-expenses',
            amount: aMoney().of('500').inUsd(),
            metadata: {},
          }),
        ],
        initialStatus: TransactionStatus.CONFIRMED,
        invoiceUrl: null,
        tags: [],
        metadata: {},
      },
      balanceRule,
      ids,
    );

    await transactions.save(transaction, { ...ctx, externalRef: null });

    return transaction.id;
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    ids = new SequentialIdGenerator();
    transactions = new LedgerTransactionRepository(
      eventStore,
      createLedgerEventRegistry(catalog),
      new EnvelopeFactory(new FixedClock(new Date('2026-07-21T10:00:00.000Z')), ids),
    );
    handler = new ReverseConfirmedTransactionHandler(
      transactions,
      balanceRule,
      ids,
      { dispatch: jest.fn().mockResolvedValue(undefined) },
      eventStore,
    );
  });

  it('reverses the original and records the reversing transaction', async () => {
    const originalId = await recordConfirmed();

    const result = await handler.execute(new ReverseConfirmedTransactionCommand(originalId), ctx);

    const reversing = await transactions.load(ctx.userId, result.aggregateId);
    expect(reversing?.status).toBe(TransactionStatus.CONFIRMED);
    expect(reversing?.postings.map((posting) => posting.amount.toDecimalString())).toEqual([
      '500',
      '-500',
    ]);
  });

  it('leaves nothing behind when the reversing append fails', async () => {
    const originalId = await recordConfirmed();
    const append = jest.spyOn(eventStore, 'append');
    let appends = 0;

    // Fail on the reversing stream, after TransactionReversed already appended.
    append.mockImplementation(async (stream, expectedVersion, events) => {
      appends += 1;

      if (appends === 2) throw new Error('reversing append failed');

      return InMemoryEventStore.prototype.append.call(
        eventStore,
        stream,
        expectedVersion,
        events,
      );
    });

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand(originalId), ctx),
    ).rejects.toThrow('reversing append failed');

    append.mockRestore();

    // The original is untouched: without the transaction it would read as
    // reversed while the reversing transaction never existed.
    const stored = await eventStore.readAll(0n, 100);
    expect(stored.map((event) => event.eventType)).toEqual(['TransactionRecorded']);
  });
});
