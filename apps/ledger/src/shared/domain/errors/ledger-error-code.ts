/**
 * Stable, client-facing domain error codes (RF-14). This constant is the single
 * source of truth for the strings the API exposes: exceptions carry them and the
 * exception filter surfaces them verbatim, so a consumer can branch on `code`
 * without parsing prose. Adding a code is additive; changing the HTTP status a
 * code maps to is a breaking change (new API version, RNF-8).
 */
export const LEDGER_ERROR_CODE = {
  UNBALANCED_TRANSACTION: 'UNBALANCED_TRANSACTION',
  ACCOUNT_CLOSED: 'ACCOUNT_CLOSED',
  CURRENCY_NOT_ALLOWED: 'CURRENCY_NOT_ALLOWED',
  DUPLICATE_EXTERNAL_REF: 'DUPLICATE_EXTERNAL_REF',
  IMMUTABLE_TRANSACTION: 'IMMUTABLE_TRANSACTION',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  NAME_COLLISION: 'NAME_COLLISION',
  SYSTEM_ACCOUNT_PROTECTED: 'SYSTEM_ACCOUNT_PROTECTED',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  LEDGER_NOT_INITIALIZED: 'LEDGER_NOT_INITIALIZED',
} as const;

/** Union of every stable RF-14 code. */
export type LedgerErrorCode = (typeof LEDGER_ERROR_CODE)[keyof typeof LEDGER_ERROR_CODE];
