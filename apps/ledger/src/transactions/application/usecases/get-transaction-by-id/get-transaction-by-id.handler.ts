import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { TransactionFinder } from '@ledger/transactions/application/ports/transaction-finder.port';
import { TransactionView } from '@ledger/transactions/application/views/transaction.view';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';

/**
 * Serves one transaction with its legs through the finder, scoped to the user
 * (INV-9). The adapter resolves the header before the legs, so a miss never
 * leaks another user's postings — `proj_postings` is keyed by transaction.
 */
export class GetTransactionByIdHandler extends QueryHandler<GetTransactionByIdQuery> {
  constructor(private readonly transactions: TransactionFinder) {
    super();
  }

  async execute(
    query: GetTransactionByIdQuery,
    ctx: QueryContext,
  ): Promise<Nullable<TransactionView>> {
    return this.transactions.byId(ctx.userId, query.transactionId);
  }
}
