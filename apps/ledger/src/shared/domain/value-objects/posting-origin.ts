/**
 * Who is asking to post against an account (INV-13).
 *
 * It travels in the command, never in client-supplied data: the
 * `{ source: 'system' }` metadata that reconciliation adjustments carry is a
 * label any caller can type into a `POST /transactions` body, and `client_id`
 * is opaque provenance and must never be used as authorization. Only a
 * command the ledger builds for itself — `RecordOpeningBalance`,
 * `ResolveDiscrepancy` — may claim {@link PostingOrigin.SYSTEM}; anything
 * arriving from the API is {@link PostingOrigin.CLIENT}, which is also the
 * default wherever the origin is not stated, so forgetting to pass it can only
 * ever fail closed.
 */
export enum PostingOrigin {
  /** An authenticated caller of the public API. Cannot touch system accounts. */
  CLIENT = 'CLIENT',

  /** A command the ledger itself issues. May post against system accounts. */
  SYSTEM = 'SYSTEM',
}
