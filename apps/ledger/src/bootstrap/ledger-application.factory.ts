import { PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';
import { AuthenticatedContextPolicy } from '@cqrs/application/command-bus/policies/authenticated-context.policy';
import { IdempotencyPolicy } from '@cqrs/application/command-bus/policies/idempotency.policy';
import { OptimisticConcurrencyPolicy } from '@cqrs/application/command-bus/policies/optimistic-concurrency.policy';
import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { SynchronousProjectionDispatcher } from '@cqrs/infrastructure/adapters/projection/synchronous-dispatcher';
import { AccountNameRegistry } from '@ledger/accounts/application/account-name.registry';
import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { CloseAccountCommand } from '@ledger/accounts/application/close-account/close-account.command';
import { CloseAccountHandler } from '@ledger/accounts/application/close-account/close-account.handler';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { OpenAccountHandler } from '@ledger/accounts/application/open-account/open-account.handler';
import { RecordOpeningBalanceCommand } from '@ledger/accounts/application/record-opening-balance/record-opening-balance.command';
import { RecordOpeningBalanceHandler } from '@ledger/accounts/application/record-opening-balance/record-opening-balance.handler';
import { RenameAccountCommand } from '@ledger/accounts/application/rename-account/rename-account.command';
import { RenameAccountHandler } from '@ledger/accounts/application/rename-account/rename-account.handler';
import { AccountTreeProjector } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { InitializeLedgerCommand } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.command';
import { InitializeLedgerHandler } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.handler';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { LedgerSettingsRepository } from '@ledger/ledger/application/ledger-settings.repository';
import { ReplaceLedgerSettingsCommand } from '@ledger/ledger/application/replace-ledger-settings/replace-ledger-settings.command';
import { ReplaceLedgerSettingsHandler } from '@ledger/ledger/application/replace-ledger-settings/replace-ledger-settings.handler';
import { LedgerSettingsProjector } from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import {
  CurrencyCatalogCache,
  StaticCurrencyCatalogCache,
} from '@ledger/reference/application/currency-catalog.cache';
import { CurrencyCatalogRepository } from '@ledger/reference/application/currency-catalog.repository';
import { RegisterCurrencyCommand } from '@ledger/reference/application/register-currency/register-currency.command';
import { RegisterCurrencyHandler } from '@ledger/reference/application/register-currency/register-currency.handler';
import { CurrenciesProjector } from '@ledger/reference/infrastructure/projections/currencies.projector';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { AmendPendingTransactionCommand } from '@ledger/transactions/application/amend-transaction/amend-pending-transaction.command';
import { AmendPendingTransactionHandler } from '@ledger/transactions/application/amend-transaction/amend-pending-transaction.handler';
import { AnnotateTransactionCommand } from '@ledger/transactions/application/annotate-transaction/annotate-transaction.command';
import { AnnotateTransactionHandler } from '@ledger/transactions/application/annotate-transaction/annotate-transaction.handler';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { ConfirmTransactionHandler } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.handler';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { RecordTransactionHandler } from '@ledger/transactions/application/record-transaction/record-transaction.handler';
import { ReverseConfirmedTransactionCommand } from '@ledger/transactions/application/reverse-transaction/reverse-confirmed-transaction.command';
import { ReverseConfirmedTransactionHandler } from '@ledger/transactions/application/reverse-transaction/reverse-confirmed-transaction.handler';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import { VoidPendingTransactionHandler } from '@ledger/transactions/application/void-transaction/void-pending-transaction.handler';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { AccountBalancesProjector } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { PendingReviewProjector } from '@ledger/transactions/infrastructure/projections/pending-review.projector';
import { TransactionListProjector } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';

/**
 * The wired write side: the command bus plus the projector set for the read
 * side. The bus is exposed as the concrete {@link PolicyCommandBus} so feature
 * modules composed outside this root can register their own handlers on
 * the same policy chain instead of bypassing it.
 */
export type LedgerApplication = {
  readonly commandBus: PolicyCommandBus;
  readonly projectors: readonly Projector[];
  readonly dispatcher: ProjectionDispatcher;
};

/** Ports the composition needs; the same wiring serves tests and the Nest module. */
export type LedgerApplicationDeps = {
  readonly eventStore: EventStore;
  readonly readModel: ReadModelStore;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly catalog: CurrencyCatalog;
  /**
   * Reload hook for a projection-backed `catalog`. Omitted by compositions
   * whose catalog is static (the seeded one tests use), where there is nothing
   * to reload after a registration.
   */
  readonly catalogCache?: CurrencyCatalogCache;
};

/**
 * Composition root for the write side. Wires repositories, projectors, the
 * synchronous dispatcher (read-your-writes) and the command bus with its
 * cross-cutting policies, then registers every core handler.
 */
export function createLedgerApplication(deps: LedgerApplicationDeps): LedgerApplication {
  const { eventStore, readModel, clock, idGenerator, catalog } = deps;

  const registry = createLedgerEventRegistry(catalog);
  const envelopes = new EnvelopeFactory(clock, idGenerator);
  const balance = new ZeroSumBalanceRule();

  const projectors: readonly Projector[] = [
    new AccountTreeProjector(),
    new TransactionListProjector(),
    new PendingReviewProjector(),
    new AccountBalancesProjector(catalog),
    new LedgerSettingsProjector(),
    // Without it `CurrencyRegistered` has no consumer and the catalog only
    // materializes through the rebuild CLI.
    new CurrenciesProjector(),
  ];
  const dispatcher = new SynchronousProjectionDispatcher(projectors, readModel);

  const accounts = new AccountRepository(eventStore, registry, envelopes);
  const transactions = new LedgerTransactionRepository(eventStore, registry, envelopes);
  const settings = new LedgerSettingsRepository(eventStore, registry, envelopes);
  const currencies = new CurrencyCatalogRepository(eventStore, registry, envelopes);
  const validation = new AccountValidationService(readModel);
  const names = new AccountNameRegistry(readModel);

  const commandBus = new PolicyCommandBus([
    new AuthenticatedContextPolicy(),
    new IdempotencyPolicy(eventStore),
    new OptimisticConcurrencyPolicy(),
  ]);

  commandBus.register(
    ReplaceLedgerSettingsCommand,
    new ReplaceLedgerSettingsHandler(settings, dispatcher),
  );
  commandBus.register(
    InitializeLedgerCommand,
    new InitializeLedgerHandler(settings, accounts, idGenerator, clock, dispatcher, eventStore),
  );
  commandBus.register(
    OpenAccountCommand,
    new OpenAccountHandler(accounts, names, idGenerator, dispatcher),
  );
  commandBus.register(RenameAccountCommand, new RenameAccountHandler(accounts, names, dispatcher));
  commandBus.register(CloseAccountCommand, new CloseAccountHandler(accounts, dispatcher));
  // Reuses `RecordTransaction` over the same bus, so it is registered with the
  // bus it dispatches into rather than with a repository of its own.
  commandBus.register(
    RecordOpeningBalanceCommand,
    new RecordOpeningBalanceHandler(commandBus, readModel, catalog),
  );
  commandBus.register(
    RecordTransactionCommand,
    new RecordTransactionHandler(transactions, validation, catalog, balance, idGenerator, dispatcher),
  );
  commandBus.register(
    ConfirmTransactionCommand,
    new ConfirmTransactionHandler(transactions, clock, dispatcher),
  );
  commandBus.register(
    AmendPendingTransactionCommand,
    new AmendPendingTransactionHandler(transactions, validation, catalog, balance, dispatcher),
  );
  commandBus.register(
    AnnotateTransactionCommand,
    new AnnotateTransactionHandler(transactions, dispatcher),
  );
  commandBus.register(
    VoidPendingTransactionCommand,
    new VoidPendingTransactionHandler(transactions, dispatcher),
  );
  commandBus.register(
    RegisterCurrencyCommand,
    new RegisterCurrencyHandler(
      currencies,
      dispatcher,
      deps.catalogCache ?? new StaticCurrencyCatalogCache(),
    ),
  );
  commandBus.register(
    ReverseConfirmedTransactionCommand,
    new ReverseConfirmedTransactionHandler(
      transactions,
      balance,
      idGenerator,
      dispatcher,
      eventStore,
    ),
  );

  return { commandBus, projectors, dispatcher };
}
