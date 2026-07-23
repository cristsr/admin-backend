import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { AccountNotFoundException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { AccountName } from '@ledger/shared-kernel/domain/value-objects';
import { RenameAccountCommand } from './rename-account.command';

/** Loads the account, applies the rename and republishes the affected projections. */
export class RenameAccountHandler extends CommandHandler<RenameAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: RenameAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const account = await this.accounts.load(ctx.userId, command.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${command.accountId}" does not exist`);
    }

    account.rename(AccountName.of(command.newName));

    const result = await this.accounts.save(account, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
