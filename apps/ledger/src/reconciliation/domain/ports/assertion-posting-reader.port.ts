import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/** A posting of the asserted account, as materialized by `proj_postings` (EP-1). */
export interface AssertablePosting {
  readonly amount: Money;
  readonly date: LedgerDate;
  readonly occurredAt: Nullable<Date>;
  readonly status: TransactionStatus;
}

/**
 * Reads the `CONFIRMED`+`PENDING` postings of exactly one account (no
 * subaccounts, §2.4) up to a temporal cutoff. `VOIDED` postings are never
 * returned. This is the permitted inter-aggregate read of §3.5/§3.6: no
 * accounting invariant depends on it.
 */
export abstract class AssertionPostingReader {
  abstract byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LedgerDate,
  ): Promise<readonly AssertablePosting[]>;
}
