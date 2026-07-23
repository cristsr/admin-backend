import { Nullable } from '@shared';
import { CommandResult } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { BalanceAssertion } from './balance-assertion.aggregate';

/**
 * Loads and persists `BalanceAssertion` streams. Backed by the assumed EP-1
 * `EventStore` at integration; the write is guarded by optimistic concurrency
 * (the loaded `currentVersion` is the expected version).
 */
export abstract class BalanceAssertionRepository {
  /** Rebuilds the aggregate from its stream, or null when it does not exist. */
  abstract load(assertionId: string): Promise<Nullable<BalanceAssertion>>;

  /**
   * Appends the aggregate's pending events under optimistic concurrency;
   * a version conflict surfaces as the assumed store's typed conflict error.
   */
  abstract save(assertion: BalanceAssertion, expectedVersion: number): Promise<CommandResult>;
}
