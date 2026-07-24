import { InMemoryReadModelStore } from './in-memory-read-model-store';
import {
  describeReadModelStoreContract,
} from '@ledger/shared-kernel/infrastructure/testing/read-model-store.contract';

describe('InMemoryReadModelStore', () => {
  describeReadModelStoreContract(async () => new InMemoryReadModelStore());
});
