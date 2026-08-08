import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { TransactionView } from '@ledger/transactions/application/views/transaction.view';

/** Reads a single transaction, with its postings, for the owning user. */
export class GetTransactionByIdQuery extends Query<Nullable<TransactionView>> {
  readonly queryType = 'GetTransactionById';

  constructor(readonly transactionId: string) {
    super();
  }
}
