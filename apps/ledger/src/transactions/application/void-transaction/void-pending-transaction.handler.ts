import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { VoidPendingTransactionCommand } from './void-pending-transaction.command';

/** Loads a transaction and voids it (only valid while PENDING). */
export class VoidPendingTransactionHandler extends CommandHandler<VoidPendingTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: VoidPendingTransactionCommand, ctx: AuthContext): Promise<CommandResult> {
    const transaction = await this.transactions.load(ctx.userId, command.transactionId);

    if (!transaction) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    transaction.void(command.reason);
    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
