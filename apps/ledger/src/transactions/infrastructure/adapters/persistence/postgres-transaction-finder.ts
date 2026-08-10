import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { DataSource } from 'typeorm';
import {
  PageRequest,
  TransactionFilter,
  TransactionFinder,
  TransactionPage,
} from '@ledger/transactions/application/ports/transaction-finder.port';
import { TransactionView } from '@ledger/transactions/application/views/transaction.view';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  PostingRow,
  TransactionRow,
  toTransactionListItemView,
  toTransactionView,
} from '@ledger/transactions/infrastructure/projections/transaction-list.schema';

/**
 * The one SQL adapter of the read-side refactor: the account filter needs an
 * `EXISTS` over `proj_postings` and the detail resolves best in a single
 * query, which the shared store cannot express (R7). Kept honest by the
 * shared contract (`transaction-finder.contract.ts`) that the in-memory twin
 * runs too.
 *
 * Parameters are always bound (`$1`, `$2`, …), never interpolated — same rule
 * as `PostgresReadModelStore`.
 */
@Injectable()
export class PostgresTransactionFinder extends TransactionFinder {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async list(
    userId: string,
    filter: TransactionFilter,
    page: PageRequest,
  ): Promise<TransactionPage> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let n = 1;

    const bind = (value: unknown): string => {
      params.push(value);
      return `$${n++}`;
    };

    conditions.push(`user_id = ${bind(userId)}`);
    if (filter.status) conditions.push(`status = ${bind(filter.status)}`);
    if (filter.derivedKind) conditions.push(`derived_kind = ${bind(filter.derivedKind)}`);
    if (filter.payee) conditions.push(`LOWER(payee) = LOWER(${bind(filter.payee)})`);
    if (filter.clientId) conditions.push(`client_id = ${bind(filter.clientId)}`);
    if (filter.fromDate) conditions.push(`date >= ${bind(filter.fromDate)}`);
    if (filter.toDate) conditions.push(`date <= ${bind(filter.toDate)}`);
    // The account filter narrows *before* pagination: without the `EXISTS`,
    // the page is drawn from every account and then thinned down, hiding
    // matches — the defect that motivated this adapter.
    if (filter.accountId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM ${PROJ_POSTINGS} p WHERE p.transaction_id = t.transaction_id AND p.account_id = ${bind(filter.accountId)})`,
      );
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const from = `FROM ${PROJ_TRANSACTIONS} t`;

    const [countRow] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*) AS total ${from} ${where}`,
      params,
    );

    const rows = await this.dataSource.query<TransactionRow[]>(
      `SELECT t.* ${from} ${where} ORDER BY t.date DESC LIMIT ${bind(page.limit)} OFFSET ${bind(page.offset)}`,
      params,
    );

    return {
      items: rows.map(toTransactionListItemView),
      total: Number(countRow?.total ?? 0),
      limit: page.limit,
      offset: page.offset,
    };
  }

  async byId(
    userId: string,
    transactionId: string,
  ): Promise<Nullable<TransactionView>> {
    const [row] = await this.dataSource.query<TransactionRow[]>(
      `SELECT * FROM ${PROJ_TRANSACTIONS} WHERE user_id = $1 AND transaction_id = $2`,
      [userId, transactionId],
    );

    if (!row) return null;

    // The header resolves for this user before the legs are read: `proj_postings`
    // is keyed by transaction, so querying it first would answer before the
    // owner was checked, leaking another user's postings (INV-9).
    const postings = await this.dataSource.query<PostingRow[]>(
      `SELECT * FROM ${PROJ_POSTINGS} WHERE user_id = $1 AND transaction_id = $2`,
      [userId, transactionId],
    );

    return toTransactionView(row, postings);
  }
}
