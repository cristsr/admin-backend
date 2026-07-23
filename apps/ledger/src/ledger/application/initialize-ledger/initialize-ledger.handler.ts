import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { LedgerSettingsRepository } from '@ledger/ledger/application/ledger-settings.repository';
import { LedgerAlreadyInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { LedgerSettings } from '@ledger/ledger/domain/settings/ledger-settings.aggregate';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandHandler } from '@ledger/shared-kernel/application/command-bus/command-handler';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { AccountName, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { InitializeLedgerCommand } from './initialize-ledger.command';

/** Canonical names of the two technical system accounts (INV-13). */
const OPENING_BALANCES = 'Equity:OpeningBalances';
const ADJUSTMENTS = 'Equity:Adjustments';

/**
 * Initializes a ledger: creates `Equity:OpeningBalances` and `Equity:Adjustments`
 * as system accounts and records {@link LedgerInitialized}. The ledger stream is
 * the idempotency anchor; the two account appends carry no external_ref
 * (anchor-only stamping).
 */
export class InitializeLedgerHandler extends CommandHandler<InitializeLedgerCommand> {
  constructor(
    private readonly settings: LedgerSettingsRepository,
    private readonly accounts: AccountRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(command: InitializeLedgerCommand, ctx: AuthContext): Promise<CommandResult> {
    const existing = await this.settings.load(ctx.userId, ctx.userId);

    if (existing?.isInitialized) {
      throw new LedgerAlreadyInitializedException(`Ledger for ${ctx.userId} already exists`);
    }

    const openedOn = LedgerDate.of(this.clock.now().toISOString().slice(0, 10));
    const opening = this.openSystemAccount(OPENING_BALANCES, openedOn);
    const adjustments = this.openSystemAccount(ADJUSTMENTS, openedOn);

    const ledger = LedgerSettings.initialize({
      userId: ctx.userId,
      presentationCurrency: command.presentationCurrency,
      timezone: command.timezone,
      openingBalancesAccountId: opening.id,
      adjustmentsAccountId: adjustments.id,
    });

    const anchor = await this.settings.save(ledger, ctx);
    const anchorless: AuthContext = { ...ctx, externalRef: null };
    const openingResult = await this.accounts.save(opening, anchorless);
    const adjustmentsResult = await this.accounts.save(adjustments, anchorless);

    await this.dispatcher.dispatch([
      ...anchor.events,
      ...openingResult.events,
      ...adjustmentsResult.events,
    ]);

    return {
      aggregateId: ctx.userId,
      streamPosition: adjustmentsResult.lastPosition,
      idempotentReplay: false,
    };
  }

  private openSystemAccount(name: string, openedOn: LedgerDate): Account {
    return Account.open(
      {
        name: AccountName.of(name),
        currencies: [],
        openedOn,
        isBankMirror: false,
        isSystem: true,
      },
      this.idGenerator,
    );
  }
}
