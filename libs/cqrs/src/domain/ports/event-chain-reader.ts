import { ChainRow } from '@cqrs/domain/event/chain-row.type';

/**
 * Read-only access to the hash chain (AC-4) — the one place `hash` is
 * visible outside the adapter that writes it. Deliberately separate from
 * {@link EventStore}: `StoredEvent` never exposes `hash` (it is a storage
 * derivative, not a domain fact), so `verify-chain` needs its own narrow
 * port instead of widening the main one for every consumer.
 */
export abstract class EventChainReader {
  /** Page of one user's chain, strictly after `fromPosition`, in ascending order. */
  abstract readChain(
    userId: string,
    fromPosition: bigint,
    limit: number,
  ): Promise<readonly ChainRow[]>;

  /** Every user with at least one chained event, for a scope-free `verify-chain` run. */
  abstract userIds(): Promise<readonly string[]>;
}
