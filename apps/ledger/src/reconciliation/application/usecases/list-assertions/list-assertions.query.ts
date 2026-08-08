import { Query } from '@cqrs/application/query-bus/query';
import { AssertionStatusView } from '@ledger/reconciliation/application/read-models/assertion-status.read-model';

/** Lists the reconciliation status of every assertion on an account. */
export class ListAssertionsQuery extends Query<readonly AssertionStatusView[]> {
  readonly queryType = 'ListAssertions';

  constructor(readonly accountId: string) {
    super();
  }
}
