// ASSUMED EP-1 CONTRACTS — replace at integration.
//
// EP-1 (the event-sourced core) is built in a parallel worktree and is not
// present here. This file locally declares the domain vocabulary and exception
// hierarchy EP-2 consumes so the HTTP adapter compiles and its tests run in
// isolation. At integration, delete this file and import the real definitions
// from EP-1's domain layer. The `code` each exception carries is the stable API
// contract (RF-14) and MUST be preserved by the real EP-1 exceptions.
import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';
import { LEDGER_ERROR_CODE } from './errors/ledger-error-code';

/** Chart-of-accounts root types (spec §2.1). Nominal enum, never a DB enum. */
export enum AccountType {
  ASSETS = 'ASSETS',
  LIABILITIES = 'LIABILITIES',
  INCOME = 'INCOME',
  EXPENSES = 'EXPENSES',
  EQUITY = 'EQUITY',
}

/** Lifecycle state of a transaction (spec §2.2). `VOIDED` is terminal. */
export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  VOIDED = 'VOIDED',
}

/**
 * Read-only classification the projector derives from the postings (RF-4). A
 * client never sends it on write; it exists only as a `transaction_list` filter.
 */
export enum DerivedKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
}

/** INV-1: postings do not net to zero per currency. */
export class UnbalancedTransactionException extends DomainUnprocessableException {
  readonly code: string = LEDGER_ERROR_CODE.UNBALANCED_TRANSACTION;
}

/** INV-4: a posting uses a currency the account does not accept. */
export class CurrencyNotAllowedException extends DomainUnprocessableException {
  readonly code: string = LEDGER_ERROR_CODE.CURRENCY_NOT_ALLOWED;
}

/** INV-3: an operation targets a closed account. */
export class AccountClosedException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.ACCOUNT_CLOSED;
}

/** INV-6: an economic change was attempted on a non-`PENDING` transaction. */
export class ImmutableTransactionException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.IMMUTABLE_TRANSACTION;
}

/** §2.1.1: the new account name collides with an existing one for the user. */
export class NameCollisionException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.NAME_COLLISION;
}

/** INV-13: close/rename attempted on a technical system account. */
export class SystemAccountProtectedException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.SYSTEM_ACCOUNT_PROTECTED;
}

/**
 * INV-7: optimistic-concurrency clash — born in the `EventStore` when the
 * expected stream version no longer matches (spec §3.8).
 */
export class ConcurrencyConflictException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.CONCURRENCY_CONFLICT;
}

/**
 * INV-10: the same `external_ref` was reused for a genuinely conflicting command
 * (not an idempotent replay). Born in the `EventStore` on `append`.
 */
export class DuplicateExternalRefException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.DUPLICATE_EXTERNAL_REF;
}

/** An operation ran before `InitializeLedger` created the technical accounts. */
export class LedgerNotInitializedException extends DomainConflictException {
  readonly code: string = LEDGER_ERROR_CODE.LEDGER_NOT_INITIALIZED;
}

/** Handler could not load the referenced account aggregate. */
export class AccountNotFoundException extends DomainNotFoundException {
  readonly code: string = LEDGER_ERROR_CODE.ACCOUNT_NOT_FOUND;
}

/** Handler could not load the referenced transaction aggregate. */
export class TransactionNotFoundException extends DomainNotFoundException {
  readonly code: string = LEDGER_ERROR_CODE.TRANSACTION_NOT_FOUND;
}
