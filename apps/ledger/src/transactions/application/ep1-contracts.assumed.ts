// ASSUMED EP-1 CONTRACTS — replace at integration.
//
// Transaction-side commands and queries owned by EP-1. EP-2 constructs and
// dispatches these; it never runs their handlers or touches the event store.
// At integration, delete this file and import the real commands/queries from
// `@ledger/transactions/application`.
import { Nullable, PropertiesOnly } from '@shared';
import { LedgerCommand, LedgerQuery } from '@ledger/shared/application/ep1-contracts.assumed';
import { DerivedKind, TransactionStatus } from '@ledger/shared/domain/ep1-contracts.assumed';

/** One leg of a transaction. Amounts are exact decimal strings (INV-8), never floats. */
export interface CommandPosting {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly metadata: Nullable<Record<string, unknown>>;
}

/** Records a new transaction, `PENDING` or `CONFIRMED` (§7.1). */
export class RecordTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly date!: string;
  readonly payee!: Nullable<string>;
  readonly description!: string;
  readonly status!: TransactionStatus;
  readonly postings!: readonly CommandPosting[];
  readonly invoiceUrl!: Nullable<string>;
  readonly tags!: readonly string[];
  readonly metadata!: Nullable<Record<string, unknown>>;

  constructor(props: PropertiesOnly<RecordTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Changes the economic facts of a still-`PENDING` transaction (INV-6, §7.1). */
export class AmendPendingTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly transactionId!: string;
  readonly postings!: Nullable<readonly CommandPosting[]>;
  readonly date!: Nullable<string>;

  constructor(props: PropertiesOnly<AmendPendingTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Adds non-economic annotations, allowed in any non-`VOIDED` state (INV-6). */
export class AnnotateTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly transactionId!: string;
  readonly payee!: Nullable<string>;
  readonly description!: Nullable<string>;
  readonly invoiceUrl!: Nullable<string>;
  readonly tags!: Nullable<readonly string[]>;
  readonly metadata!: Nullable<Record<string, unknown>>;

  constructor(props: PropertiesOnly<AnnotateTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Freezes a `PENDING` transaction into `CONFIRMED` (§7.1). */
export class ConfirmTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly transactionId!: string;
  readonly postings!: Nullable<readonly CommandPosting[]>;

  constructor(props: PropertiesOnly<ConfirmTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Voids a `PENDING` transaction with a reason (INV-6, §7.1). */
export class VoidPendingTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly transactionId!: string;
  readonly reason!: string;

  constructor(props: PropertiesOnly<VoidPendingTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Reverses a `CONFIRMED` transaction, creating a linked reversal (§7.3). */
export class ReverseConfirmedTransactionCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly transactionId!: string;
  readonly reason!: Nullable<string>;

  constructor(props: PropertiesOnly<ReverseConfirmedTransactionCommand>) {
    Object.assign(this, props);
  }
}

/** Filters for the `transaction_list` projection (RF-13). All optional. */
export interface TransactionListFilters {
  readonly accountId: Nullable<string>;
  readonly from: Nullable<string>;
  readonly to: Nullable<string>;
  readonly status: Nullable<TransactionStatus>;
  readonly derivedKind: Nullable<DerivedKind>;
  readonly payee: Nullable<string>;
  readonly clientId: Nullable<string>;
  readonly limit: Nullable<number>;
  readonly offset: Nullable<number>;
}

/** Reads a page of the `transaction_list` projection (§7, RF-13). */
export class TransactionListQuery implements LedgerQuery {
  readonly userId!: string;
  readonly filters!: TransactionListFilters;

  constructor(props: PropertiesOnly<TransactionListQuery>) {
    Object.assign(this, props);
  }
}

/** Reads a single transaction from the `transaction_list` projection. */
export class TransactionByIdQuery implements LedgerQuery {
  readonly userId!: string;
  readonly transactionId!: string;

  constructor(props: PropertiesOnly<TransactionByIdQuery>) {
    Object.assign(this, props);
  }
}
