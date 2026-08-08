import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { AccountName, LedgerDate } from '@ledger/shared/domain/value-objects';
import { OpenSystemAccountCommand } from './open-system-account.command';

/**
 * Opens a technical account (`isSystem: true`, INV-13).
 *
 * Two deliberate differences with `OpenAccountHandler`, both because the caller
 * owns a transaction this handler runs inside:
 *
 * - **It does not dispatch projections.** `InitializeLedger` dispatches once for
 *   the three appends after its scope commits, so that a failing projector
 *   cannot roll back accounting facts that already committed. A dispatch here
 *   would run inside that scope and undo the guarantee.
 * - **It does not check name uniqueness.** At initialization `proj_accounts` is
 *   empty and the previous append has not projected yet, so a registry lookup
 *   would report every name as available regardless of what was just written.
 *   The two names are constants and distinct, so the check would be theatre —
 *   saying so here beats an implicit omission.
 */
export class OpenSystemAccountHandler extends CommandHandler<OpenSystemAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly idGenerator: IdGenerator,
  ) {
    super();
  }

  async execute(command: OpenSystemAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const account = Account.open(
      {
        name: AccountName.of(command.name),
        // A technical account takes any currency: opening balances and
        // adjustments are booked in whatever the counterparty uses.
        currencies: [],
        openedOn: LedgerDate.of(command.openedOn),
        isBankMirror: false,
        isSystem: true,
      },
      this.idGenerator,
    );

    const result = await this.accounts.save(account, ctx);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
