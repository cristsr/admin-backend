import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Payee } from '@ledger/shared/domain/value-objects';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { AnnotateTransactionCommand } from './annotate-transaction.command';

/** Applies an annotative change to a transaction without touching its postings. */
export class AnnotateTransactionHandler extends CommandHandler<AnnotateTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: AnnotateTransactionCommand, ctx: AuthContext): Promise<CommandResult> {
    const transaction = await this.transactions.load(ctx.userId, command.transactionId);

    if (!transaction) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    transaction.annotate({
      payee: Payee.of(command.payee)?.value ?? null,
      description: command.description,
      invoiceUrl: command.invoiceUrl,
      tags: command.tags,
      metadata: command.metadata,
    });

    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
