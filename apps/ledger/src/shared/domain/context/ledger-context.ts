/**
 * The authenticated context that must accompany every request and rides
 * into each command/query, where the handler stamps it onto every event.
 *
 * - `userId` owns the ledger and partitions all data (INV-9).
 * - `clientId` is opaque provenance (frontend, mail system, automator). The
 *   ledger never validates or manages client identity — it only requires the
 *   value's presence and records it as metadata.
 */
export type LedgerContext = {
  readonly userId: string;
  readonly clientId: string;
};
