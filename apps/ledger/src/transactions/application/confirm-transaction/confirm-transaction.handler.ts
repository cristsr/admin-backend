import { Clock } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { ConfirmTransactionCommand } from './confirm-transaction.command';

/** Loads a transaction and confirms it (PENDING -> CONFIRMED). */
export class ConfirmTransactionHandler extends CommandHandler<ConfirmTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly clock: Clock,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: ConfirmTransactionCommand, ctx: AuthContext): Promise<CommandResult> {
    const transaction = await this.transactions.load(ctx.userId, command.transactionId);

    if (!transaction) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    transaction.confirm(this.clock);
    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
