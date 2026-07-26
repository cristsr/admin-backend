import { Injectable } from '@nestjs/common';
import { Criteria } from '@shared';
import {
  AssertablePosting,
  AssertionPostingReader,
  TouchedAccount,
} from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { Money } from '@ledger/shared/domain/money';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { PROJ_POSTINGS } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';

type PostingRow = {
  readonly transaction_id: string;
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
  readonly date: string;
};

/**
 * Reads an account's `CONFIRMED`+`PENDING` postings up to a cutoff from
 * `proj_postings` (§2.4). `VOIDED` rows are excluded. The projection has no
 * per-posting instant, so `occurredAt` is null — intraday ordering is a
 * TODO(intraday) that a future join onto `proj_transactions.occurred_at` covers.
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
    const rows = await this.readModel.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    return rows
      .filter((row) => row.status !== TransactionStatus.VOIDED)
      .map((row) => this.toPosting(row))
      .filter((posting) => posting.date.isSameOrBefore(date));
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
      occurredAt: null,
      status: row.status as TransactionStatus,
    };
  }
}
