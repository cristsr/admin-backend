import { IdGenerator } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ReverseConfirmedTransactionCommand } from './reverse-confirmed-transaction.command';

/**
 * Reverses a confirmed transaction. Records the linked reversing transaction
 * (inverted postings, `reverses_id` metadata, CONFIRMED) and emits
 * {@link TransactionReversed} on the original — a single audited write path
 * (§3.4). The original stream is the idempotency anchor; the reversing append
 * carries no external_ref (anchor-only stamping).
 *
 * The two appends land on different streams, so both run inside
 * `EventStore.withTransaction` (INV-7): a process dying between them would
 * leave the original marked as reversed with no reversing transaction to
 * offset it — visible data loss, not a recoverable intermediate state.
 * Projection dispatch stays outside the scope: read models are rebuildable,
 * so a projector failure must not roll back the accounting facts.
 */
export class ReverseConfirmedTransactionHandler extends CommandHandler<ReverseConfirmedTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly balance: BalanceRule,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
    private readonly eventStore: EventStore,
  ) {
    super();
  }

  async execute(
    command: ReverseConfirmedTransactionCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const original = await this.transactions.load(ctx.userId, command.transactionId);

    if (!original) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    const reversing = LedgerTransaction.record(
      {
        date: original.date,
        payee: null,
        description: `Reversal of ${original.id}`,
        postings: original.postings.map((posting) => posting.negated()),
        initialStatus: TransactionStatus.CONFIRMED,
        invoiceUrl: null,
        tags: [],
        metadata: { reverses_id: original.id },
      },
      this.balance,
      this.idGenerator,
    );

    // Guarded by the aggregate: only CONFIRMED transactions can be reversed.
    original.reverse(reversing.id);

    const anchorless: AuthContext = { ...ctx, externalRef: null };
    const { originalResult, reversingResult } = await this.eventStore.withTransaction(async () => {
      const originalResult = await this.transactions.save(original, ctx);
      const reversingResult = await this.transactions.save(reversing, anchorless);

      return { originalResult, reversingResult };
    });

    await this.dispatcher.dispatch([...originalResult.events, ...reversingResult.events]);

    return {
      aggregateId: reversing.id,
      streamPosition: reversingResult.lastPosition,
      idempotentReplay: false,
    };
  }
}
