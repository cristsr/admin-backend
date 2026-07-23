import { Nullable } from '@shared';
import {
  AssertablePosting,
  AssertionPostingReader,
} from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { LocalDate, TransactionStatus } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** A stored posting row keyed by owner and account, for the in-memory reader. */
interface StoredPosting extends AssertablePosting {
  readonly userId: string;
  readonly accountId: string;
}

/**
 * In-memory double of {@link AssertionPostingReader}: mirrors the real adapter's
 * contract (exact account, `date <= cutoff`, `VOIDED` excluded) so the evaluator
 * can be driven without a database.
 */
export class InMemoryAssertionPostingReader extends AssertionPostingReader {
  private readonly rows: StoredPosting[] = [];

  /** Seeds a posting; `VOIDED` rows are dropped, matching `proj_postings` reads. */
  add(
    userId: string,
    accountId: string,
    posting: AssertablePosting,
  ): InMemoryAssertionPostingReader {
    if (posting.status === TransactionStatus.VOIDED) return this;

    this.rows.push({ ...posting, userId, accountId });

    return this;
  }

  byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LocalDate,
  ): Promise<readonly AssertablePosting[]> {
    const matches = this.rows.filter(
      (row) => row.userId === userId && row.accountId === accountId && row.date.isOnOrBefore(date),
    );

    return Promise.resolve(matches.map((row) => this.strip(row)));
  }

  private strip(row: StoredPosting): AssertablePosting {
    const occurredAt: Nullable<Date> = row.occurredAt;

    return { amount: row.amount, date: row.date, occurredAt, status: row.status };
  }
}
