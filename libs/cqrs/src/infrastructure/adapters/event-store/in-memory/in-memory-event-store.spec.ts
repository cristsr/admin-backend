import { describeEventStoreContract } from '@cqrs/infrastructure/testing/event-store.contract';
import { InMemoryEventStore } from './in-memory-event-store';

describeEventStoreContract(async () => new InMemoryEventStore());
