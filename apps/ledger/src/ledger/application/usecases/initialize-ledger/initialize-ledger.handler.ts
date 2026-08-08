import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Clock } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { OpenSystemAccountCommand } from '@ledger/accounts/application/usecases/open-system-account/open-system-account.command';
import { LedgerSettingsRepository } from '@ledger/ledger/application/repositories/ledger-settings.repository';
import { LedgerAlreadyInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { LedgerSettings } from '@ledger/ledger/domain/settings/ledger-settings.aggregate';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { InitializeLedgerCommand } from './initialize-ledger.command';

/** Canonical names of the two technical system accounts (INV-13). */
const OPENING_BALANCES = 'Equity:OpeningBalances';
const ADJUSTMENTS = 'Equity:Adjustments';

/** The aggregate type the accounts module streams under; used to read back their events. */
const ACCOUNT_AGGREGATE = 'Account';

/**
 * Initializes a ledger: creates `Equity:OpeningBalances` and `Equity:Adjustments`
 * as system accounts and records {@link LedgerInitialized}. The ledger stream is
 * the idempotency anchor; the two account appends carry no external_ref
 * (anchor-only stamping).
 *
 * The settings and the two accounts are three different streams, so all three
 * appends run inside `EventStore.withTransaction` (INV-7). Without it a process
 * dying mid-command leaves either technical accounts with no `LedgerSettings`
 * pointing at them, or settings naming accounts that do not exist — and INV-13
 * states those accounts exist *from initialization*, a claim a half-written
 * ledger silently breaks. Re-running the command would not repair it either:
 * the settings stream is the idempotency anchor.
 *
 * The accounts are opened through the {@link CommandBus} rather than built here.
 * `Account` belongs to the `accounts` module, and constructing it from this one
 * meant a rule added to account opening would silently skip the technical
 * accounts — the compiler would keep accepting the old call.
 */
export class InitializeLedgerHandler extends CommandHandler<InitializeLedgerCommand> {
  constructor(
    private readonly settings: LedgerSettingsRepository,
    private readonly commandBus: CommandBus,
    private readonly clock: Clock,
    private readonly dispatcher: ProjectionDispatcher,
    private readonly eventStore: EventStore,
  ) {
    super();
  }

  async execute(command: InitializeLedgerCommand, ctx: AuthContext): Promise<CommandResult> {
    const existing = await this.settings.load(ctx.userId, ctx.userId);

    if (existing?.isInitialized) {
      throw new LedgerAlreadyInitializedException(`Ledger for ${ctx.userId} already exists`);
    }

    const openedOn = LedgerDate.of(this.clock.now().toISOString().slice(0, 10));
    // The accounts commit before the settings now, because their ids only exist
    // once the command that opens them has run. INV-7 is unaffected: all three
    // appends still share the one scope opened below.
    const anchorless: AuthContext = { ...ctx, externalRef: null };

    const written = await this.eventStore.withTransaction(async () => {
      const opening = await this.commandBus.dispatch(
        new OpenSystemAccountCommand(OPENING_BALANCES, openedOn.value),
        anchorless,
      );
      const adjustments = await this.commandBus.dispatch(
        new OpenSystemAccountCommand(ADJUSTMENTS, openedOn.value),
        anchorless,
      );

      const ledger = LedgerSettings.initialize({
        userId: ctx.userId,
        presentationCurrency: command.presentationCurrency,
        timezone: command.timezone,
        openingBalancesAccountId: opening.aggregateId,
        adjustmentsAccountId: adjustments.aggregateId,
      });

      const anchor = await this.settings.save(ledger, ctx);

      // The bus returns ids, never events (rules Art. 10), so the accounts'
      // events are read back from their streams. Without this the projection
      // dispatch below would carry only the settings event and `proj_accounts`
      // would never learn the system accounts exist — silently, since no append
      // failed.
      const accountEvents = await this.openedAccountEvents(ctx.userId, [
        opening.aggregateId,
        adjustments.aggregateId,
      ]);

      return {
        events: [...accountEvents, ...anchor.events],
        lastPosition: anchor.lastPosition,
      };
    });

    // Outside the scope on purpose: read models are rebuildable, so a projector
    // failure must not roll back the accounting facts that already committed.
    await this.dispatcher.dispatch(written.events);

    return {
      aggregateId: ctx.userId,
      streamPosition: written.lastPosition,
      idempotentReplay: false,
    };
  }

  /** The events of each just-opened system account, in the order they were opened. */
  private async openedAccountEvents(
    userId: string,
    accountIds: readonly string[],
  ): Promise<readonly StoredEvent[]> {
    const streams = await Promise.all(
      accountIds.map((aggregateId) =>
        this.eventStore.load({ userId, aggregateType: ACCOUNT_AGGREGATE, aggregateId }),
      ),
    );

    return streams.flat();
  }
}
