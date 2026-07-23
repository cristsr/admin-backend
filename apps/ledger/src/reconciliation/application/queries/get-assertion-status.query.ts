import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  AssertionStatusRow,
  AssertionStatusStore,
} from '@ledger/reconciliation/domain/ports/assertion-status-store.port';

/** Reads a single assertion's reconciliation status. */
export class GetAssertionStatusQuery {
  constructor(
    readonly userId: string,
    readonly assertionId: string,
  ) {}
}

@Injectable()
export class GetAssertionStatusHandler {
  constructor(private readonly store: AssertionStatusStore) {}

  execute(query: GetAssertionStatusQuery): Promise<Nullable<AssertionStatusRow>> {
    return this.store.byId(query.userId, query.assertionId);
  }
}
