import { Criteria } from '@shared';
import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { NameCollisionException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { IdGenerator } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  AccountName,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared-kernel/domain/value-objects';
import { OpenAccountCommand } from './open-account.command';

/** Opens an account after checking its name is unique against `account_tree`. */
export class OpenAccountHandler extends CommandHandler<OpenAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly readModel: ReadModelStore,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: OpenAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const name = AccountName.of(command.name);
    await this.ensureNameIsFree(ctx.userId, name);

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

  private async ensureNameIsFree(userId: string, name: AccountName): Promise<void> {
    const clash = await this.readModel.query(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('name', name.value),
    );

    if (clash.length) {
      throw new NameCollisionException(`Account "${name.value}" already exists`);
    }
  }
}
