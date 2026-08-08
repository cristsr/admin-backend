import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { PostingOrigin } from '@ledger/accounts/application/posting-origin';
import {
  LedgerSettingsRow,
  PROJ_LEDGER_SETTINGS,
} from '@ledger/ledger/application/read-models/ledger-settings.read-model';
import { LedgerNotInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared/domain/value-objects';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { RecordOpeningBalanceCommand } from './record-opening-balance.command';

/** Narration of the opening entry; the audit trail lives in the metadata. */
const DESCRIPTION = 'Opening balance';

/**
 * Records the opening balance of a pre-existing account: a `CONFIRMED`
 * two-posting transaction between the account and the user's
 * `Equity:OpeningBalances`, which is the same mechanism used for
 * reconciliation adjustments with a different counterparty.
 *
 * It reuses the real `RecordTransaction` through the {@link CommandBus} rather
 * than building a `LedgerTransaction` here — the same route `ResolveDiscrepancy`
 * takes (DRY). Balancing (INV-1/INV-11), posting precision and the
 * cross-aggregate account checks (INV-3/INV-4) therefore stay in exactly one
 * place. This handler owns only what is specific to an opening entry: resolving
 * the counterparty, and stating {@link PostingOrigin.SYSTEM}, which is what lets
 * it reach the technical account (INV-13).
 */
export class RecordOpeningBalanceHandler extends CommandHandler<RecordOpeningBalanceCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly readModel: ReadModelStore,
    private readonly catalog: CurrencyCatalog,
  ) {
    super();
  }

  async execute(command: RecordOpeningBalanceCommand, ctx: AuthContext): Promise<CommandResult> {
    const openingBalancesAccountId = await this.openingBalancesAccountId(ctx.userId);
    // Built as Money so the counter-posting is negated at the currency's exact
    // scale (Art. 7); the balance rule refuses anything that does not net to zero.
    const amount = Money.of(command.amount, this.catalog.resolve(CurrencyCode.of(command.currency)));

    return this.commandBus.dispatch(
      new RecordTransactionCommand(
        command.date,
        null,
        DESCRIPTION,
        [
          {
            accountId: command.accountId,
            amount: amount.toDecimalString(),
            currency: command.currency,
          },
          {
            accountId: openingBalancesAccountId,
            amount: amount.negate().toDecimalString(),
            currency: command.currency,
          },
        ],
        TransactionStatus.CONFIRMED,
        null,
        [],
        { source: 'system', opens_account: command.accountId },
        // An opening balance states a position, not a moment: there is no
        // business instant to declare.
        null,
        PostingOrigin.SYSTEM,
      ),
      ctx,
    );
  }

  /** The user's `Equity:OpeningBalances`, created when the ledger was initialized. */
  private async openingBalancesAccountId(userId: string): Promise<string> {
    const [settings] = await this.readModel.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    if (!settings?.opening_balances_account_id) {
      throw new LedgerNotInitializedException(
        `Ledger for ${userId} has no Equity:OpeningBalances; initialize it first`,
      );
    }

    return settings.opening_balances_account_id;
  }
}
