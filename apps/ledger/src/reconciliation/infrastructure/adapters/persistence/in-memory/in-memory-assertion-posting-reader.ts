import { Nullable } from '@shared';
import {
  AssertablePosting,
  AssertionPostingReader,
  TouchedAccount,
} from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import { LedgerDate } from '@ledger/shared/domain/value-objects';

/** A stored posting row keyed by owner, account and transaction. */
type StoredPosting = AssertablePosting & {
  readonly userId: string;
  readonly accountId: string;
  readonly transactionId: Nullable<string>;
};

/**
 * In-memory double of {@link AssertionPostingReader}: mirrors the real adapter's
 * contract so the evaluator and the reactor can be driven without a database.
 *
 * `VOIDED` rows are kept and filtered **on read**, the way `proj_postings`
 * behaves: `byAccountUpToDate` excludes them, but `touchedByTransaction` must
 * still see them — its whole job is finding the accounts a just-voided
 * transaction touched.
 */
export class InMemoryAssertionPostingReader extends AssertionPostingReader {
  private readonly rows: StoredPosting[] = [];

  /** Seeds a posting, optionally attributing it to a transaction. */
  add(
    userId: string,
    accountId: string,
    posting: AssertablePosting,
    transactionId: Nullable<string> = null,
  ): InMemoryAssertionPostingReader {
    this.rows.push({ ...posting, userId, accountId, transactionId });

    return this;
  }

  byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LedgerDate,
  ): Promise<readonly AssertablePosting[]> {
    const matches = this.rows.filter(
      (row) =>
        row.userId === userId &&
        row.accountId === accountId &&
        row.status !== TransactionStatus.VOIDED &&
        row.date.isSameOrBefore(date),
    );

    return Promise.resolve(matches.map((row) => this.strip(row)));
  }

  touchedByTransaction(
    userId: string,
    transactionId: string,
  ): Promise<readonly TouchedAccount[]> {
    const byAccount = new Map<string, TouchedAccount>();

    for (const row of this.rows) {
      if (row.userId !== userId || row.transactionId !== transactionId) continue;
      if (byAccount.has(row.accountId)) continue; // guard: one entry per account

      byAccount.set(row.accountId, { accountId: row.accountId, date: row.date });
    }

    return Promise.resolve([...byAccount.values()]);
  }

  private strip(row: StoredPosting): AssertablePosting {
    const occurredAt: Nullable<Date> = row.occurredAt;

    return { amount: row.amount, date: row.date, occurredAt, status: row.status };
  }
}
