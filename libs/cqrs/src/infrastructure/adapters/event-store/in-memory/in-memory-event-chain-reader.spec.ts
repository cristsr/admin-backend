import { describeEventChainReaderContract } from '@cqrs/infrastructure/testing/event-chain-reader.contract';
import { InMemoryEventChainReader } from './in-memory-event-chain-reader';
import { InMemoryEventStore } from './in-memory-event-store';

describeEventChainReaderContract(async () => {
  const store = new InMemoryEventStore();
  return { store, reader: new InMemoryEventChainReader(store) };
});
