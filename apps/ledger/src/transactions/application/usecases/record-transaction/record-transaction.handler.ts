import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { IdGenerator } from '@cqrs/domain/ports';
import { CurrencyCatalog, LedgerDate, Payee } from '@ledger/shared/domain/value-objects';
import { toPostingLines } from '@ledger/transactions/application/factories/posting.factory';
import { PostingValidator } from '@ledger/transactions/application/ports/posting-validator.port';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { RecordTransactionCommand } from './record-transaction.command';

/**
 * Records a transaction: builds postings at currency precision, validates the
 * accounts against `account_tree` (INV-3/INV-4), then lets the aggregate enforce
 * INV-1/INV-2 before appending.
 */
export class RecordTransactionHandler extends CommandHandler<RecordTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly validation: PostingValidator,
    private readonly catalog: CurrencyCatalog,
    private readonly balance: BalanceRule,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: RecordTransactionCommand, ctx: AuthContext): Promise<CommandResult> {
    const date = LedgerDate.of(command.date);
    const postings = toPostingLines(command.postings, this.catalog);

    await this.validation.validate(ctx.userId, date, postings, command.origin);

    const transaction = LedgerTransaction.record(
      {
        date,
        payee: Payee.of(command.payee),
        description: command.description,
        postings,
        initialStatus: command.initialStatus,
        invoiceUrl: command.invoiceUrl,
        tags: command.tags,
        metadata: command.metadata,
        occurredAt: command.occurredAt ? new Date(command.occurredAt) : null,
      },
      this.balance,
      this.idGenerator,
    );

    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
