import { Nullable } from '@shared';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { FixedClock, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { MergePendingTransfersCommand } from './application/commands/merge-pending-transfers.command';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { LedgerTransactionRepository } from './application/ledger-transaction.repository';
import { RecordTransactionCommand } from './application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from './application/void-transaction/void-pending-transaction.command';
import { BalanceRule } from './domain/balance/balance-rule';
import { ZeroSumBalanceRule } from './domain/balance/zero-sum-balance-rule';
import { AccountFacts, AccountLookup } from './domain/ports/account-lookup.port';
import { PostingLine } from './domain/posting/posting-line';
import { TransferPairRule } from './domain/services/transfer-pair.rule';
import { LedgerTransaction } from './domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from './domain/transaction/transaction-status';

/** Both transfer accounts are real; the counterpart category is not. */
class TransferAccountsLookup extends AccountLookup {
  factsOf(_userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    const type = accountId.startsWith('acc-') ? 'ASSETS' : 'EXPENSES';

    return Promise.resolve({ accountId, type, currency: 'USD', isBankMirror: type === 'ASSETS' });
  }
}

/**
 * Test double for the write side: appends `TransactionVoided` (continuing the
 * leg's own stream) and `TransactionRecorded` (a fresh stream for the merged
 * transfer), the way the real EP-1 handlers would. Only what
 * `MergePendingTransfersHandler` dispatches.
 */
class TransferFlowBus extends CommandBus {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly balanceRule: BalanceRule,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    if (command instanceof VoidPendingTransactionCommand) {
      const transaction = await this.transactions.load(ctx.userId, command.transactionId);

      if (!transaction) throw new Error(`Unknown transaction ${command.transactionId}`);

      transaction.void(command.reason);
      const result = await this.transactions.save(transaction, ctx);

      return {
        aggregateId: command.transactionId,
        streamPosition: result.lastPosition,
        idempotentReplay: false,
      };
    }

    if (command instanceof RecordTransactionCommand) {
      const transaction = LedgerTransaction.record(
        {
          date: LedgerDate.of(command.date),
          payee: null,
          description: command.description,
          postings: command.postings.map((posting) =>
            PostingLine.of({
              accountId: posting.accountId,
              amount: aMoney().of(posting.amount).inUsd(),
              metadata: {},
            }),
          ),
          initialStatus: command.initialStatus,
          invoiceUrl: null,
          tags: [],
          metadata: command.metadata,
        },
        this.balanceRule,
        this.ids,
      );
      const result = await this.transactions.save(transaction, ctx);

      return {
        aggregateId: transaction.id,
        streamPosition: result.lastPosition,
        idempotentReplay: false,
      };
    }

    throw new Error(`Unsupported command in this e2e double: ${command.commandType}`);
  }
}

/**
 * End-to-end transfer merge (spec §7.2) over the real EP-1 event store, event
 * registry and event-sourced repository: two opposite pending legs are merged
 * into a single confirmed transfer, both originals end up VOIDED, and the
 * resulting transfer is readable back from the stream.
 */
describe('Transfer merge flow (e2e)', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'merge-1' };
  const catalog = new SeedCurrencyCatalog();
  const balanceRule = new ZeroSumBalanceRule();

  let eventStore: InMemoryEventStore;
  let transactions: LedgerTransactionRepository;
  let ids: IdGenerator;
  let clock: Clock;
  let handler: MergePendingTransfersHandler;

  /** Seeds one PENDING transaction: a real-account leg against a category. */
  const recordPending = async (accountId: string, amount: string): Promise<string> => {
    const transaction = LedgerTransaction.record(
      {
        date: LedgerDate.of('2026-07-20'),
        payee: null,
        description: 'leg',
        postings: [
          PostingLine.of({ accountId, amount: aMoney().of(amount).inUsd(), metadata: {} }),
          PostingLine.of({
            accountId: 'suspense',
            amount: aMoney().of(amount).inUsd().negate(),
            metadata: {},
          }),
        ],
        initialStatus: TransactionStatus.PENDING,
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
    clock = new FixedClock(new Date('2026-07-21T10:00:00.000Z'));
    transactions = new LedgerTransactionRepository(
      eventStore,
      createLedgerEventRegistry(catalog),
      new EnvelopeFactory(clock, ids),
    );

    handler = new MergePendingTransfersHandler(
      transactions,
      new TransferAccountsLookup(),
      new TransferPairRule(),
      new TransferFlowBus(transactions, balanceRule, ids),
      eventStore,
    );
  });

  it('merges the two legs into a confirmed transfer and voids both originals', async () => {
    const outgoingId = await recordPending('acc-out', '-500');
    const incomingId = await recordPending('acc-in', '500');

    const output = await handler.execute(
      new MergePendingTransfersCommand([outgoingId, incomingId]),
      ctx,
    );

    expect(output.voidedTransactionIds).toEqual([outgoingId, incomingId]);

    // Both original legs left PENDING.
    const outgoing = await transactions.load('user-1', outgoingId);
    const incoming = await transactions.load('user-1', incomingId);
    expect(outgoing?.status).toBe(TransactionStatus.VOIDED);
    expect(incoming?.status).toBe(TransactionStatus.VOIDED);

    // A single confirmed transfer between the two real accounts.
    const transfer = await transactions.load('user-1', output.transferTransactionId);
    expect(transfer?.status).toBe(TransactionStatus.CONFIRMED);
    expect(transfer?.date.value).toBe('2026-07-20');
    expect(transfer?.postings.map((posting) => posting.accountId)).toEqual(['acc-out', 'acc-in']);

    const voided = (await eventStore.readAll(0n, 100)).filter(
      (entry) => entry.eventType === 'TransactionVoided',
    );
    expect(voided).toHaveLength(2);
  });

  it('refuses to merge once one of the legs is no longer pending', async () => {
    const outgoingId = await recordPending('acc-out', '-500');
    const incomingId = await recordPending('acc-in', '500');

    await handler.execute(new MergePendingTransfersCommand([outgoingId, incomingId]), ctx);

    await expect(
      handler.execute(new MergePendingTransfersCommand([outgoingId, incomingId]), ctx),
    ).rejects.toThrow();
  });
  it('leaves nothing behind when the merge fails midway (hu-0023)', async () => {
    const outgoingId = await recordPending('acc-out', '-500');
    const incomingId = await recordPending('acc-in', '500');

    // Fail on the transfer record, after both voids already appended.
    const failing = new (class extends TransferFlowBus {
      async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
        if (command instanceof RecordTransactionCommand) {
          throw new Error('transfer record failed');
        }

        return super.dispatch(command, ctx);
      }
    })(transactions, balanceRule, ids);

    const failingHandler = new MergePendingTransfersHandler(
      transactions,
      new TransferAccountsLookup(),
      new TransferPairRule(),
      failing,
      eventStore,
    );

    await expect(
      failingHandler.execute(new MergePendingTransfersCommand([outgoingId, incomingId]), ctx),
    ).rejects.toThrow('transfer record failed');

    // Both legs are still PENDING. Without the transaction the user would have
    // lost a pending with nothing replacing it.
    expect((await transactions.load('user-1', outgoingId))?.status).toBe(TransactionStatus.PENDING);
    expect((await transactions.load('user-1', incomingId))?.status).toBe(TransactionStatus.PENDING);
  });
});
