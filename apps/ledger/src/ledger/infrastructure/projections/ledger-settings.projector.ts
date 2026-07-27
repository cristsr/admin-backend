import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Criteria } from '@shared';

/** Read-model table name for the per-user ledger settings. */
export const PROJ_LEDGER_SETTINGS = 'proj_ledger_settings';

/** One row of `proj_ledger_settings`: the user's presentation settings and system accounts. */
export type LedgerSettingsRow = {
  readonly user_id: string;
  readonly presentation_currency: string;
  readonly timezone: string;
  readonly opening_balances_account_id: string;
  readonly adjustments_account_id: string;
  readonly is_initialized: boolean;
};

/**
 * Maintains `proj_ledger_settings` from `LedgerInitialized` (§6.2). EP-1 did not
 * ship this projector, yet the settings read (EP-2) and the day-boundary resolver
 * (EP-3, via {@link LedgerSettingsReader}) both need the user's timezone — this
 * fills that gap. The stream is keyed by the user id, so one row per user.
 */
export class LedgerSettingsProjector extends Projector {
  readonly name = 'ledger_settings';
  readonly consumes = ['LedgerInitialized', 'PresentationCurrencyChanged', 'TimezoneChanged'];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    if (event.eventType === 'LedgerInitialized') {
      return this.write(store, event.userId, {
        user_id: event.userId,
        presentation_currency: payload.presentationCurrency as string,
        timezone: payload.timezone as string,
        opening_balances_account_id: payload.openingBalancesAccountId as string,
        adjustments_account_id: payload.adjustmentsAccountId as string,
        is_initialized: true,
      });
    }

    // The two change events only carry their own field, but `upsert` replaces the
    // whole row by contract — writing just that column would wipe the technical
    // account ids. Read, merge, write back complete.
    const current = await this.rowOf(store, event.userId);

    if (!current) return; // guard: a change on a ledger that was never initialized

    if (event.eventType === 'PresentationCurrencyChanged') {
      return this.write(store, event.userId, {
        ...current,
        presentation_currency: payload.presentationCurrency as string,
      });
    }

    if (event.eventType === 'TimezoneChanged') {
      return this.write(store, event.userId, {
        ...current,
        timezone: payload.timezone as string,
      });
    }
  }

  private async rowOf(store: ReadModelStore, userId: string): Promise<LedgerSettingsRow | null> {
    const rows = await store.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    return rows[0] ?? null;
  }

  private write(
    store: ReadModelStore,
    userId: string,
    row: LedgerSettingsRow,
  ): Promise<void> {
    return store.upsert(PROJ_LEDGER_SETTINGS, { user_id: userId }, row);
  }
}
