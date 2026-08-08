import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import {
  AssertablePosting,
  AssertionPostingReader,
  TouchedAccount,
} from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared/domain/value-objects';
import { PROJ_POSTINGS, PostingRow } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';

/**
 * Reads an account's `CONFIRMED`+`PENDING` postings up to a cutoff from
 * `proj_postings`. `VOIDED` rows are excluded.
 *
 * `occurred_at` is denormalized onto each posting by the transaction projector,
 * so intraday ordering needs no join. It stays null when the client never
 * declared an instant — the evaluator treats those as ambiguous rather than
 * assuming an order, which is what produces `INDETERMINATE` instead of a wrong
 * verdict.
 */
@Injectable()
export class ReadModelAssertionPostingReader extends AssertionPostingReader {
  constructor(
    private readonly readModel: ReadModelStore,
    private readonly catalog: CurrencyCatalog,
  ) {
    super();
  }

  async byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LedgerDate,
  ): Promise<readonly AssertablePosting[]> {
    // The VOIDED and cutoff filters live in the WHERE, not in a `filter()`
    // after the fetch: the `(user_id, account_id, date)` index covers exactly
    // this query. Comparing `date` as text is safe — the column is DATE and
    // the format ISO, so lexicographic and chronological order coincide.
    const rows = await this.readModel.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none()
        .equals('user_id', userId)
        .equals('account_id', accountId)
        .notEquals('status', TransactionStatus.VOIDED)
        .lessOrEqual('date', date.value),
    );

    return rows.map((row) => this.toPosting(row));
  }

  async touchedByTransaction(
    userId: string,
    transactionId: string,
  ): Promise<readonly TouchedAccount[]> {
    const rows = await this.readModel.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('user_id', userId).equals('transaction_id', transactionId),
    );

    const byAccount = new Map<string, TouchedAccount>();

    for (const row of rows) {
      if (byAccount.has(row.account_id)) continue; // guard: one entry per account

      byAccount.set(row.account_id, {
        accountId: row.account_id,
        date: LedgerDate.of(row.date),
      });
    }

    return [...byAccount.values()];
  }

  private toPosting(row: PostingRow): AssertablePosting {
    const currency = this.catalog.resolve(CurrencyCode.of(row.currency_code));

    return {
      amount: Money.of(row.amount, currency),
      date: LedgerDate.of(row.date),
      occurredAt: row.occurred_at ? new Date(row.occurred_at) : null,
      status: row.status as TransactionStatus,
    };
  }
}
