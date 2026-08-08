import { Nullable } from '@shared';
import { LedgerSettingsView } from '@ledger/ledger/application/views/ledger-settings.view';

/**
 * Read port over the ledger settings projection, serving the settings query.
 *
 * Writes are deliberately absent: `LedgerSettingsProjector` is the only writer
 * and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class LedgerSettingsFinder {
  /** The user's settings, or null when the ledger was never initialized. */
  abstract byUser(userId: string): Promise<Nullable<LedgerSettingsView>>;
}
