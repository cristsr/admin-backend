import { describeEventStoreContract } from '@ledger/shared-kernel/infrastructure/testing/event-store.contract';
import { InMemoryEventStore } from './in-memory-event-store';

describeEventStoreContract(async () => new InMemoryEventStore());
