import { Nullable } from '@shared';
import {
  PendingLegRow,
  TransferCandidateRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';

/** In-memory double of {@link TransferCandidateStore}, shared by contract tests. */
export class InMemoryTransferCandidateStore extends TransferCandidateStore {
  private readonly legs = new Map<string, PendingLegRow>();
  private readonly pairs = new Map<string, TransferCandidateRow>();

  upsertPendingLeg(leg: PendingLegRow): Promise<void> {
    this.legs.set(leg.transactionId, leg);

    return Promise.resolve();
  }

  removePendingLeg(transactionId: string): Promise<void> {
    this.legs.delete(transactionId);

    for (const [pairId, pair] of this.pairs) {
      if (pair.outgoingTxnId === transactionId || pair.incomingTxnId === transactionId) {
        this.pairs.delete(pairId);
      }
    }

    return Promise.resolve();
  }

  pendingLegs(userId: string): Promise<readonly PendingLegRow[]> {
    return Promise.resolve([...this.legs.values()].filter((leg) => leg.userId === userId));
  }

  upsertPair(pair: TransferCandidateRow): Promise<void> {
    this.pairs.set(pair.pairId, pair);

    return Promise.resolve();
  }

  listPairs(userId: string): Promise<readonly TransferCandidateRow[]> {
    return Promise.resolve([...this.pairs.values()].filter((pair) => pair.userId === userId));
  }

  pairById(userId: string, pairId: string): Promise<Nullable<TransferCandidateRow>> {
    const pair = this.pairs.get(pairId);

    return Promise.resolve(pair && pair.userId === userId ? pair : null);
  }

  truncate(): Promise<void> {
    this.legs.clear();
    this.pairs.clear();

    return Promise.resolve();
  }
}
