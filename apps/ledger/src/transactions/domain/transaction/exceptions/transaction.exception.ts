import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

/** No transaction exists for the given id and user. */
export class TransactionNotFoundException extends DomainNotFoundException {
  readonly code: string = 'TRANSACTION_NOT_FOUND';
}

/** A transaction's postings do not sum to zero for some currency (INV-1). */
export class UnbalancedTransactionException extends DomainUnprocessableException {
  readonly code: string = 'UNBALANCED_TRANSACTION';
}

/** A transaction must have at least two postings (INV-2). */
export class InsufficientPostingsException extends DomainUnprocessableException {
  readonly code: string = 'INSUFFICIENT_POSTINGS';
}

/**
 * An economic change was attempted on a non-PENDING transaction (INV-6);
 * corrections to confirmed transactions are made only via a linked reversal.
 */
export class ImmutableTransactionException extends DomainConflictException {
  readonly code: string = 'IMMUTABLE_TRANSACTION';
}

/** A lifecycle transition is invalid from the current status (confirm/void/reverse). */
export class InvalidTransactionStateException extends DomainConflictException {
  readonly code: string = 'INVALID_TRANSACTION_STATE';
}
