import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { CURRENCY_REGISTERED } from '@ledger/reference/domain/currency/events/currency-registered.event';

/** Read-model table backing the reference currency catalog. */
export const PROJ_CURRENCIES = 'proj_currencies';

/**
 * Materializes `proj_currencies` from `CurrencyRegistered`. Global by design:
 * the table has no `user_id`, because a currency's precision is universal.
 */
export class CurrenciesProjector extends Projector {
  readonly name = 'currencies';

  readonly consumes = [CURRENCY_REGISTERED];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType !== CURRENCY_REGISTERED) return; // guard

    const payload = event.payload as Record<string, unknown>;

    await store.upsert(
      PROJ_CURRENCIES,
      { code: payload.code as string },
      {
        code: payload.code as string,
        minor_units: payload.minorUnits as number,
        name: payload.name as string,
        registered_at: event.occurredAt,
      },
    );
  }
}
