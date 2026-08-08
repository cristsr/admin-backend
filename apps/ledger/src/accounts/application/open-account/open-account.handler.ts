import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { AccountNameRegistry } from '@ledger/accounts/application/services/account-name.registry';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import {
  AccountName,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared/domain/value-objects';
import { OpenAccountCommand } from './open-account.command';

/** Opens an account after checking its name is unique against `account_tree`. */
export class OpenAccountHandler extends CommandHandler<OpenAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly names: AccountNameRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: OpenAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const name = AccountName.of(command.name);
    await this.names.ensureAvailable(ctx.userId, name);

    const account = Account.open(
      {
        name,
        currencies: command.currencies.map((code) => CurrencyCode.of(code)),
        openedOn: LedgerDate.of(command.openedOn),
        isBankMirror: command.isBankMirror,
        isSystem: false,
      },
      this.idGenerator,
    );

    const result = await this.accounts.save(account, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
