import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { AssertionStatusView } from '@ledger/reconciliation/application/read-models/assertion-status.read-model';

/**
 * Reads a single assertion's reconciliation status. The owning user travels in
 * the {@link QueryContext}, not here: scoping is the bus's contract for every
 * read (INV-9), not something each query restates.
 */
export class GetAssertionStatusQuery extends Query<Nullable<AssertionStatusView>> {
  readonly queryType = 'GetAssertionStatus';

  constructor(readonly assertionId: string) {
    super();
  }
}
