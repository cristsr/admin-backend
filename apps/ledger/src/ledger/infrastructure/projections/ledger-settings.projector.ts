import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';

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
  readonly consumes = ['LedgerInitialized'];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType !== 'LedgerInitialized') return;

    const payload = event.payload as Record<string, unknown>;
    const row: LedgerSettingsRow = {
      user_id: event.userId,
      presentation_currency: payload.presentationCurrency as string,
      timezone: payload.timezone as string,
      opening_balances_account_id: payload.openingBalancesAccountId as string,
      adjustments_account_id: payload.adjustmentsAccountId as string,
      is_initialized: true,
    };

    await store.upsert(PROJ_LEDGER_SETTINGS, { user_id: event.userId }, row);
  }
}
