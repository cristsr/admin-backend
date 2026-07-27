import {
  AccountClosed,
  AccountOpened,
  AccountRenamed,
} from '@ledger/accounts/domain/account/events';
import { LedgerInitialized } from '@ledger/ledger/domain/settings/events/ledger-initialized.event';
import { CurrencyRegistered } from '@ledger/reference/domain/currency/events/currency-registered.event';
import {
  PresentationCurrencyChanged,
  TimezoneChanged,
} from '@ledger/settings/domain/ledger-settings/events';
import {
  DomainEventRegistry,
  EventRegistry,
} from '@ledger/shared-kernel/application/event/event-registry';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import {
  TransactionAmended,
  TransactionAnnotated,
  TransactionConfirmed,
  TransactionRecorded,
  TransactionReversed,
  TransactionVoided,
  TransfersMerged,
} from '@ledger/transactions/domain/transaction/events';

/**
 * Wires every domain event's deserializer into an {@link EventRegistry} (RNF-6).
 * Events carrying postings resolve `Money` scale through the {@link CurrencyCatalog}.
 * This is the composition point where the modules' event catalogs meet.
 */
export function createLedgerEventRegistry(catalog: CurrencyCatalog): EventRegistry {
  const registry = new DomainEventRegistry();

  registry.register('AccountOpened', (_v, payload) => AccountOpened.fromPayload(payload));
  registry.register('AccountRenamed', (_v, payload) => AccountRenamed.fromPayload(payload));
  registry.register('AccountClosed', (_v, payload) => AccountClosed.fromPayload(payload));

  registry.register('TransactionRecorded', (_v, payload) =>
    TransactionRecorded.fromPayload(payload, catalog),
  );
  registry.register('TransactionAmended', (_v, payload) =>
    TransactionAmended.fromPayload(payload, catalog),
  );
  registry.register('TransactionAnnotated', (_v, payload) =>
    TransactionAnnotated.fromPayload(payload),
  );
  registry.register('TransactionConfirmed', (_v, payload) =>
    TransactionConfirmed.fromPayload(payload),
  );
  registry.register('TransactionVoided', (_v, payload) => TransactionVoided.fromPayload(payload));
  registry.register('TransactionReversed', (_v, payload) =>
    TransactionReversed.fromPayload(payload),
  );
  registry.register('TransfersMerged', (_v, payload) =>
    TransfersMerged.fromPayload(payload, catalog),
  );

  registry.register('LedgerInitialized', (_v, payload) => LedgerInitialized.fromPayload(payload));
  registry.register('PresentationCurrencyChanged', (_v, payload) =>
    PresentationCurrencyChanged.fromPayload(payload),
  );
  registry.register('TimezoneChanged', (_v, payload) => TimezoneChanged.fromPayload(payload));
  registry.register('CurrencyRegistered', (_v, payload) => CurrencyRegistered.fromPayload(payload));

  return registry;
}
