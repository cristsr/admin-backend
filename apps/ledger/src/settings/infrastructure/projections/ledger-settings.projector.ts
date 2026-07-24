import { Injectable } from '@nestjs/common';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';

/**
 * Maintains `proj_ledger_settings` from settings events. Handles:
 * - LedgerInitialized: inserts the initial row (presentation currency, timezone, system accounts)
 * - PresentationCurrencyChanged: updates `presentation_currency`
 * - TimezoneChanged: updates `timezone`
 *
 * The stream is keyed by `{ user_id }` — one row per user.
 */
@Injectable()
export class LedgerSettingsProjector extends Projector {
  readonly name = 'ledger_settings';
  readonly consumes = ['LedgerInitialized', 'PresentationCurrencyChanged', 'TimezoneChanged'];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType === 'LedgerInitialized') return this.onLedgerInitialized(event, store);
    if (event.eventType === 'PresentationCurrencyChanged') return this.onPresentationCurrencyChanged(event, store);
    if (event.eventType === 'TimezoneChanged') return this.onTimezoneChanged(event, store);
  }

  private async onLedgerInitialized(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    await store.upsert('proj_ledger_settings', { user_id: event.userId }, {
      user_id: event.userId,
      presentation_currency: payload.presentationCurrency,
      timezone: payload.timezone,
      updated_at: new Date(),
    });
  }

  private async onPresentationCurrencyChanged(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    await store.upsert('proj_ledger_settings', { user_id: event.userId }, {
      presentation_currency: payload.presentationCurrency,
      updated_at: new Date(),
    });
  }

  private async onTimezoneChanged(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    await store.upsert('proj_ledger_settings', { user_id: event.userId }, {
      timezone: payload.timezone,
      updated_at: new Date(),
    });
  }
}
