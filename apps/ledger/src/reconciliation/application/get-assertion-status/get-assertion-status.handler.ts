import { Nullable } from '@shared';
import {
  AssertionStatusRow,
  AssertionStatusStore,
} from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { GetAssertionStatusQuery } from './get-assertion-status.query';

export class GetAssertionStatusHandler {
  constructor(private readonly store: AssertionStatusStore) {}

  execute(query: GetAssertionStatusQuery): Promise<Nullable<AssertionStatusRow>> {
    return this.store.byId(query.userId, query.assertionId);
  }
}
