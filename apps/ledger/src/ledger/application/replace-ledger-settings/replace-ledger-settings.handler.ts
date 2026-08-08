import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { LedgerSettingsRepository } from '@ledger/ledger/application/ledger-settings.repository';
import { LedgerNotInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { CurrencyCode, IanaTimeZone } from '@ledger/shared/domain/value-objects';
import { ReplaceLedgerSettingsCommand } from './replace-ledger-settings.command';

/**
 * Replaces the ledger's presentation currency and timezone.
 *
 * Both changes go through the same aggregate and are persisted with a single
 * `save`, so the two events share one append: there is no state where the
 * currency changed and the timezone did not. The aggregate stays silent
 * on a value that did not change, so replacing with identical values appends
 * nothing at all.
 */
export class ReplaceLedgerSettingsHandler extends CommandHandler<ReplaceLedgerSettingsCommand> {
  constructor(
    private readonly settings: LedgerSettingsRepository,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }

  async execute(
    command: ReplaceLedgerSettingsCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const ledger = await this.settings.load(ctx.userId, ctx.userId);

    if (!ledger?.isInitialized) {
      throw new LedgerNotInitializedException(
        `Ledger for user "${ctx.userId}" has not been initialized`,
      );
    }

    ledger.changePresentationCurrency(CurrencyCode.of(command.presentationCurrency));
    ledger.changeTimezone(IanaTimeZone.of(command.timezone));

    const result = await this.settings.save(ledger, ctx);
    await this.dispatcher.dispatch(result.events);

    return {
      aggregateId: ctx.userId,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
