import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { InMemoryEventStore } from './in-memory-event-store';

/** Pairs with a concrete {@link InMemoryEventStore} to expose its chain for verification. */
export class InMemoryEventChainReader extends EventChainReader {
  constructor(private readonly store: InMemoryEventStore) {
    super();
  }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    return this.store.readChainRows(userId, fromPosition, limit);
  }

  async userIds(): Promise<readonly string[]> {
    return this.store.chainedUserIds();
  }
}
