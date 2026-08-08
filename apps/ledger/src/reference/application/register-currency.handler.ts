import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import {
  CURRENCY_CATALOG_ID,
  CurrencyCatalogAggregate,
} from '@ledger/reference/domain/currency/currency-catalog.aggregate';
import { CurrencyCatalogCache } from './currency-catalog.cache';
import { CurrencyCatalogRepository, SYSTEM_USER_ID } from './currency-catalog.repository';
import { RegisterCurrencyCommand } from './register-currency.command';

/**
 * Registers a currency in the global catalog.
 *
 * The command runs against the system-owned stream, not the caller's: the
 * catalog is shared. After persisting, the read-model catalog is refreshed so
 * the next synchronous `resolve` sees the new currency without waiting for a
 * poller.
 */
export class RegisterCurrencyHandler extends CommandHandler<RegisterCurrencyCommand> {
  constructor(
    private readonly catalog: CurrencyCatalogRepository,
    private readonly dispatcher: ProjectionDispatcher,
    private readonly catalogCache: CurrencyCatalogCache,
  ) {
    super();
  }

  async execute(command: RegisterCurrencyCommand, ctx: AuthContext): Promise<CommandResult> {
    const aggregate = await this.catalog.loadCatalog();

    aggregate.register(command.code, command.minorUnits, command.name);

    // The stream is owned by the system; the caller's client_id still travels in
    // the envelope for audit.
    const systemCtx: AuthContext = { ...ctx, userId: SYSTEM_USER_ID };
    const result = await this.catalog.save(aggregate, systemCtx);

    await this.dispatcher.dispatch(result.events);
    await this.catalogCache.refresh();

    return {
      aggregateId: CURRENCY_CATALOG_ID,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}

export { CurrencyCatalogAggregate };
