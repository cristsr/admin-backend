/**
 * The settings as the API exposes them. The system account ids stay out: they
 * are an internal detail of how opening balances and adjustments are booked,
 * and nothing a client may post against directly (INV-13). That asymmetry is
 * what keeps the view separate from the physical row it maps
 * (`infrastructure/projections/ledger-settings.schema.ts`) — the read side
 * that serves this view and the write side that resolves those ids speak
 * different languages on purpose.
 */
export type LedgerSettingsView = {
  readonly presentationCurrency: string;
  readonly timezone: string;
  readonly isInitialized: boolean;
};
