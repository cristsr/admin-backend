import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

/** No assertion exists for the given id. */
export class AssertionNotFoundException extends DomainNotFoundException {
  readonly code = 'ASSERTION_NOT_FOUND';
}

/** A revoked assertion cannot be revoked again. Stable code for the API. */
export class AssertionAlreadyRevokedException extends DomainConflictException {
  readonly code = 'ASSERTION_ALREADY_REVOKED';
}

/**
 * The assertion is not in a state that admits evaluation. Currently unused as a
 * throw (late re-evaluations are a silent no-op) but part of
 * the aggregate's exception vocabulary for callers that want strict semantics.
 */
export class AssertionNotEvaluableException extends DomainUnprocessableException {
  readonly code = 'ASSERTION_NOT_EVALUABLE';
}

/**
 * The discrepancy cannot be resolved: the assertion is not `MISMATCHED`, is
 * revoked, or was already resolved by a prior adjustment ("resolved once").
 */
export class DiscrepancyNotResolvableException extends DomainConflictException {
  readonly code = 'DISCREPANCY_NOT_RESOLVABLE';
}

/**
 * The account's currency does not match the asserted currency — a configuration
 * error the evaluator refuses to guess through: the account must be exact.
 */
export class AssertionCurrencyMismatchException extends DomainUnprocessableException {
  readonly code = 'ASSERTION_CURRENCY_MISMATCH';
}

// `LedgerNotInitializedException` is not declared here: reconciliation raises
// the shared one from `shared/domain/errors`, because three modules report the
// same condition under the same client-facing code.
