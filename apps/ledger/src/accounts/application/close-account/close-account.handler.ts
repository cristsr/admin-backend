import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { AccountNotFoundException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { CloseAccountCommand } from './close-account.command';

/** Loads the account, closes it on the given date and republishes its projections. */
export class CloseAccountHandler extends CommandHandler<CloseAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: CloseAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const account = await this.accounts.load(ctx.userId, command.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${command.accountId}" does not exist`);
    }

    account.close(LedgerDate.of(command.closedOn));

    const result = await this.accounts.save(account, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
