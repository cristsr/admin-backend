import { Nullable } from '@shared';

/** One inbox entry as the API exposes it. */
export type PendingReviewView = {
  readonly id: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly description: string;
  /** How many legs the pending transaction has, so a client can flag compounds. */
  readonly postingCount: number;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
};
