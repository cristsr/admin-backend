import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { AccountNameRegistry } from '@ledger/accounts/application/account-name.registry';
import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { AccountNotFoundException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { AccountName } from '@ledger/shared/domain/value-objects';
import { RenameAccountCommand } from './rename-account.command';

/**
 * Loads the account, applies the rename and republishes the affected
 * projections. The new name must not collide with another account
 * of the user, and the rename drags every descendant with it, so the
 * whole resulting subtree is cleared with {@link AccountNameRegistry} before
 * anything is emitted.
 */
export class RenameAccountHandler extends CommandHandler<RenameAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly names: AccountNameRegistry,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: RenameAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const account = await this.accounts.load(ctx.userId, command.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${command.accountId}" does not exist`);
    }

    const newName = AccountName.of(command.newName);
    await this.names.ensureRenameable(ctx.userId, account.name, newName);

    account.rename(newName);

    const result = await this.accounts.save(account, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
