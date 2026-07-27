import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CurrenciesController } from '@ledger/reference/infrastructure/adapters/http/currencies.controller';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';

/**
 * Reference data: the global currency catalog (RF-21).
 *
 * Neither side of the catalog is composed here: `RegisterCurrencyHandler` is
 * registered on the `CommandBus` by `createLedgerApplication` and
 * `ListCurrenciesHandler` on the `QueryBus` by `createQueryBus`, which are the
 * two buses {@link CurrenciesController} dispatches into. This module only owns
 * the HTTP surface and the boot hydration.
 *
 * `ReadModelCurrencyCatalog` is hydrated on boot because `CurrencyCatalog.resolve`
 * is synchronous and is called during stream rehydration — by the time an
 * aggregate with money is loaded, the cache has to be warm already.
 */
@Module({
  controllers: [CurrenciesController],
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
