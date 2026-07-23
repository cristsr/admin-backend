import { Query } from '@ledger/shared-kernel/application/query-bus/query';

/** Reads a single transaction from `proj_transactions` for the owning user (RF-13). */
export class GetTransactionByIdQuery extends Query {
  readonly queryType = 'GetTransactionById';

  constructor(readonly transactionId: string) {
    super();
  }
}
