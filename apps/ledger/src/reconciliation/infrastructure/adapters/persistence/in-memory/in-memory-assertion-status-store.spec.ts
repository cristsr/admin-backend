import { runAssertionStatusStoreContract } from '@ledger/reconciliation/domain/ports/assertion-status-store.contract';
import { InMemoryAssertionStatusStore } from './in-memory-assertion-status-store';

describe('InMemoryAssertionStatusStore', () => {
  // The same suite runs against the TypeORM adapter at integration (RNF-11).
  runAssertionStatusStoreContract(() => new InMemoryAssertionStatusStore());
});
