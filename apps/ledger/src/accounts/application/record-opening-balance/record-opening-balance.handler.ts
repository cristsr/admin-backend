import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { IdGenerator } from '@cqrs/domain/ports';
import { Criteria } from '@shared';
import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { PostingOrigin } from '@ledger/accounts/application/posting-origin';
import { LedgerNotInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import {
  LedgerSettingsRow,
  PROJ_LEDGER_SETTINGS,
} from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import { Money } from '@ledger/shared/domain/money';
import {
  CurrencyCatalog,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared/domain/value-objects';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { toPostingLines } from '@ledger/transactions/application/posting.factory';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { RecordOpeningBalanceCommand } from './record-opening-balance.command';

/** Narration of the opening entry; the audit trail lives in the metadata. */
const DESCRIPTION = 'Opening balance';

/**
 * Records the opening balance of a pre-existing account (RF-27): a `CONFIRMED`
 * two-posting transaction between the account and the user's
 * `Equity:OpeningBalances`, which is the same mechanism §2.4.1 describes for
 * reconciliation adjustments with a different counterparty.
 *
 * It takes the ordinary domain path — {@link toPostingLines} for precision,
 * {@link AccountValidationService} for INV-3/INV-4, and
 * {@link LedgerTransaction.record} for INV-1/INV-2 through the one
 * {@link BalanceRule} (INV-11) — and differs from a client-issued transaction in
 * exactly one respect: it validates with {@link PostingOrigin.SYSTEM}, which is
 * what lets it reach the technical account (INV-13).
 */
export class RecordOpeningBalanceHandler extends CommandHandler<RecordOpeningBalanceCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly validation: AccountValidationService,
    private readonly readModel: ReadModelStore,
    private readonly catalog: CurrencyCatalog,
    private readonly balance: BalanceRule,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(
    command: RecordOpeningBalanceCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const openingBalancesAccountId = await this.openingBalancesAccountId(ctx.userId);
    const date = LedgerDate.of(command.date);
    const amount = Money.of(
      command.amount,
      this.catalog.resolve(CurrencyCode.of(command.currency)),
    );

    const postings = toPostingLines(
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
      this.catalog,
    );

    await this.validation.validate(ctx.userId, date, postings, PostingOrigin.SYSTEM);

    const transaction = LedgerTransaction.record(
      {
        date,
        payee: null,
        description: DESCRIPTION,
        postings,
        initialStatus: TransactionStatus.CONFIRMED,
        invoiceUrl: null,
        tags: [],
        metadata: { source: 'system', opens_account: command.accountId },
      },
      this.balance,
      this.idGenerator,
    );

    const result = await this.transactions.save(transaction, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: transaction.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
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
