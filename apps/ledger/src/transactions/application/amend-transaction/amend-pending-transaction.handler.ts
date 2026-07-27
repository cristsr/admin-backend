import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { PostingOrigin } from '@ledger/accounts/application/posting-origin';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { CurrencyCatalog, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { toPostingLines } from '@ledger/transactions/application/posting.factory';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { AmendPendingTransactionCommand } from './amend-pending-transaction.command';

/** Re-validates accounts and amends a PENDING transaction's postings and date (INV-6). */
export class AmendPendingTransactionHandler extends CommandHandler<AmendPendingTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly validation: AccountValidationService,
    private readonly catalog: CurrencyCatalog,
    private readonly balance: BalanceRule,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(
    command: AmendPendingTransactionCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const transaction = await this.transactions.load(ctx.userId, command.transactionId);

    if (!transaction) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    const date = LedgerDate.of(command.date);
    const postings = toPostingLines(command.postings, this.catalog);
    await this.validation.validate(ctx.userId, date, postings, PostingOrigin.CLIENT);

    transaction.amend(postings, date, this.balance);
    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
