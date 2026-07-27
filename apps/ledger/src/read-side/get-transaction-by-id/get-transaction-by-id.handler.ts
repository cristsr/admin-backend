import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, Nullable } from '@shared';
import { PROJ_TRANSACTIONS } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';

type TransactionRow = { readonly transaction_id: string; readonly user_id: string };

/** Serves one transaction from `proj_transactions`, scoped to the user (INV-9). */
export class GetTransactionByIdHandler extends QueryHandler<
  GetTransactionByIdQuery,
  Nullable<TransactionRow>
> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: GetTransactionByIdQuery,
    ctx: QueryContext,
  ): Promise<Nullable<TransactionRow>> {
    const [row] = await this.readModel.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('user_id', ctx.userId).equals('transaction_id', query.transactionId),
    );

    return row ?? null;
  }
}
