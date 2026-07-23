import { Nullable } from '@shared';

/** A pending leg tracked by the projector's working set. */
export interface PendingLegRow {
  readonly transactionId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly date: string;
  readonly isRealAccount: boolean;
  /** The leg's own external reference, preserved in the merged transfer (§7.2). */
  readonly externalRef: Nullable<string>;
}

/** A materialized `transfer_candidates` pair (proj_transfer_candidates, RF-15). */
export interface TransferCandidateRow {
  readonly pairId: string;
  readonly userId: string;
  readonly outgoingTxnId: string;
  readonly incomingTxnId: string;
  readonly outgoingAccountId: string;
  readonly incomingAccountId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly gapDays: number;
}

/**
 * Read/write port for the `transfer_candidates` projection. Tracks the pending
 * legs it detects from (its working set) and the detected pairs. The projector
 * is the only writer (RNF-10).
 */
export abstract class TransferCandidateStore {
  abstract upsertPendingLeg(leg: PendingLegRow): Promise<void>;

  /** Drops a leg leaving `PENDING` (void/confirm/merge) and any pair it is in. */
  abstract removePendingLeg(transactionId: string): Promise<void>;

  abstract pendingLegs(userId: string): Promise<readonly PendingLegRow[]>;

  abstract upsertPair(pair: TransferCandidateRow): Promise<void>;

  abstract listPairs(userId: string): Promise<readonly TransferCandidateRow[]>;

  /** A single pair by its deterministic id, for merge validation. */
  abstract pairById(userId: string, pairId: string): Promise<Nullable<TransferCandidateRow>>;

  abstract truncate(): Promise<void>;
}
