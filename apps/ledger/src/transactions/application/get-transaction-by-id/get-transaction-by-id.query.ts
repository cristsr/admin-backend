import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** One transaction as `proj_transactions` stores it. */
export type TransactionRow = {
  readonly transaction_id: string;
  readonly user_id: string;
};

/** Reads a single transaction from `proj_transactions` for the owning user. */
export class GetTransactionByIdQuery extends Query<Nullable<TransactionRow>> {
  readonly queryType = 'GetTransactionById';

  constructor(readonly transactionId: string) {
    super();
  }
}
