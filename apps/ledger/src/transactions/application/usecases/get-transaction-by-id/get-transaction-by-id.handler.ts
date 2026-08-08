import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, Nullable } from '@shared';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  PostingRow,
  TransactionRow,
  TransactionView,
  toTransactionView,
} from '@ledger/transactions/application/read-models/transaction-list.read-model';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';

/**
 * Serves one transaction from `proj_transactions` with its legs from
 * `proj_postings`, scoped to the user (INV-9).
 *
 * The postings are fetched only after the transaction resolves for this user,
 * so a miss never leaks another user's legs — `proj_postings` is keyed by
 * transaction, and querying it first would answer before the scope is checked.
 */
export class GetTransactionByIdHandler extends QueryHandler<GetTransactionByIdQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: GetTransactionByIdQuery,
    ctx: QueryContext,
  ): Promise<Nullable<TransactionView>> {
    const [row] = await this.readModel.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none()
        .equals('user_id', ctx.userId)
        .equals('transaction_id', query.transactionId),
    );

    if (!row) return null;

    const postings = await this.readModel.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('transaction_id', row.transaction_id),
    );

    return toTransactionView(row, postings);
  }
}
