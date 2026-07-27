import {
  describeReadModelStoreContract,
} from '@ledger/shared-kernel/infrastructure/testing/read-model-store.contract';
import { InMemoryReadModelStore } from './in-memory-read-model-store';

describe('InMemoryReadModelStore', () => {
  describeReadModelStoreContract(async () => new InMemoryReadModelStore());
});
