import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { CurrencyCatalogRepository } from '@ledger/reference/application/currency-catalog.repository';
import { ListCurrenciesHandler } from '@ledger/reference/application/list-currencies.query';
import { RegisterCurrencyHandler } from '@ledger/reference/application/register-currency.handler';
import { CurrenciesController } from '@ledger/reference/infrastructure/adapters/http/currencies.controller';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects/currency-catalog';

/**
 * Reference data: the global currency catalog (RF-21).
 *
 * `ReadModelCurrencyCatalog` is hydrated on boot because `CurrencyCatalog.resolve`
 * is synchronous and is called during stream rehydration — by the time an
 * aggregate with money is loaded, the cache has to be warm already.
 */
@Module({
  controllers: [CurrenciesController],
  providers: [
    {
      provide: EventRegistry,
      inject: [CurrencyCatalog],
      useFactory: (catalog: CurrencyCatalog): EventRegistry => createLedgerEventRegistry(catalog),
    },
    {
      provide: CurrencyCatalogRepository,
      inject: [EventStore, EventRegistry, EnvelopeFactory],
      useFactory: (
        eventStore: EventStore,
        registry: EventRegistry,
        envelopes: EnvelopeFactory,
      ): CurrencyCatalogRepository =>
        new CurrencyCatalogRepository(eventStore, registry, envelopes),
    },
    {
      provide: EnvelopeFactory,
      inject: [Clock, IdGenerator],
      useFactory: (clock: Clock, ids: IdGenerator): EnvelopeFactory =>
        new EnvelopeFactory(clock, ids),
    },
    {
      provide: ListCurrenciesHandler,
      inject: [ReadModelStore],
      useFactory: (store: ReadModelStore): ListCurrenciesHandler =>
        new ListCurrenciesHandler(store),
    },
    RegisterCurrencyHandler,
  ],
})
export class ReferenceModule implements OnModuleInit {
  private readonly logger = new Logger(ReferenceModule.name);

  constructor(private readonly catalog: ReadModelCurrencyCatalog) {}

  /**
   * Warms the cache before the first synchronous `resolve`.
   *
   * A failure here degrades but does not stop the boot: the ISO base currencies
   * resolve from the adapter regardless, so the ledger still works for COP and
   * USD while the projection is unreachable. Refusing to start over reference
   * data would be a worse trade.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.catalog.refresh();
    } catch (error) {
      this.logger.warn(
        `Could not hydrate the currency catalog; falling back to the ISO base set: ${
          (error as Error).message
        }`,
      );
    }
  }
}
