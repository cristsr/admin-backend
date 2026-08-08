import { DomainUnprocessableException } from '@shared';
import { LEDGER_ERROR_CODE } from './ledger-error-code';

/**
 * An operation needs a ledger that was never initialized.
 *
 * Shared rather than owned by a module: `ledger` raises it when the settings
 * stream is empty, `accounts` when the opening-balances account cannot be
 * resolved, and `reconciliation` when there is no timezone to derive a day
 * boundary from. It used to exist twice, in two modules, under the same
 * `code` — which meant the frozen code → status contract only covered one of
 * them, and the two could drift into different HTTP statuses for the same
 * string without any test noticing.
 */
export class LedgerNotInitializedException extends DomainUnprocessableException {
  readonly code: string = LEDGER_ERROR_CODE.LEDGER_NOT_INITIALIZED;
}
