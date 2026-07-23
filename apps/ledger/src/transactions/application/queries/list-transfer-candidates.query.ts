import { Injectable } from '@nestjs/common';
import {
  TransferCandidateRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';

/** Lists the user's current transfer-candidate pairs. */
export class ListTransferCandidatesQuery {
  constructor(readonly userId: string) {}
}

@Injectable()
export class ListTransferCandidatesHandler {
  constructor(private readonly store: TransferCandidateStore) {}

  execute(query: ListTransferCandidatesQuery): Promise<readonly TransferCandidateRow[]> {
    return this.store.listPairs(query.userId);
  }
}
