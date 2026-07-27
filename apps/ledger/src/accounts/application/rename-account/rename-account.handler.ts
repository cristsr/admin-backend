import { AccountNameRegistry } from '@ledger/accounts/application/account-name.registry';
import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { AccountNotFoundException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { AccountName } from '@ledger/shared-kernel/domain/value-objects';
import { RenameAccountCommand } from './rename-account.command';

/**
 * Loads the account, applies the rename and republishes the affected
 * projections. §2.1.1 forbids the new name from colliding with another account
 * of the user, and the rename drags every descendant with it (§6.3), so the
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
