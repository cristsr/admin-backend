import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import { LedgerDate } from '@ledger/shared/domain/value-objects';

/** A posting of the asserted account, as materialized by `proj_postings`. */
export type AssertablePosting = {
  readonly amount: Money;
  readonly date: LedgerDate;
  readonly occurredAt: Nullable<Date>;
  readonly status: TransactionStatus;
};

/** An account a transaction posted to, with that transaction's accounting date. */
export type TouchedAccount = {
  readonly accountId: string;
  readonly date: LedgerDate;
};

/**
 * Reads the `CONFIRMED`+`PENDING` postings of exactly one account (no
 * subaccounts) up to a temporal cutoff. `VOIDED` postings are never
 * returned. This is the one permitted inter-aggregate read: no
 * accounting invariant depends on it.
 */
export abstract class AssertionPostingReader {
  abstract byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LedgerDate,
  ): Promise<readonly AssertablePosting[]>;

  /**
   * Accounts a single transaction posted to, with its accounting date. Serves
   * the reactor when the triggering event carries no postings in its payload
   * (`TransactionVoided` only ships a reason).
   *
   * Unlike {@link byAccountUpToDate}, this one **includes** `VOIDED` rows on
   * purpose: the whole point is finding which accounts a just-voided
   * transaction used to touch.
   */
  abstract touchedByTransaction(
    userId: string,
    transactionId: string,
  ): Promise<readonly TouchedAccount[]>;
}
