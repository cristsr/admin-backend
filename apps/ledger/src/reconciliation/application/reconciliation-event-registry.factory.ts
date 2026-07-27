import {
  AssertionRevoked,
  BalanceAsserted,
  BalanceAssertionEvaluated,
  DiscrepancyResolved,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import {
  DomainEventRegistry,
  EventRegistry,
} from '@ledger/shared-kernel/application/event/event-registry';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';

/**
 * Wires the reconciliation domain events' deserializers into an
 * {@link EventRegistry} (RNF-6). Events carrying money resolve `Money` scale
 * through the {@link CurrencyCatalog}. Kept separate from the core registry so
 * the reconciliation stream can be replayed in isolation.
 */
export function createReconciliationEventRegistry(catalog: CurrencyCatalog): EventRegistry {
  const registry = new DomainEventRegistry();

  registry.register('BalanceAsserted', (_v, payload) => BalanceAsserted.fromPayload(payload, catalog));
  registry.register('BalanceAssertionEvaluated', (_v, payload) =>
    BalanceAssertionEvaluated.fromPayload(payload, catalog),
  );
  registry.register('AssertionRevoked', (_v, payload) => AssertionRevoked.fromPayload(payload));
  registry.register('DiscrepancyResolved', (_v, payload) => DiscrepancyResolved.fromPayload(payload));

  return registry;
}
