import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { AccountRepository } from '@ledger/accounts/application/account.repository';
import { CloseAccountHandler } from '@ledger/accounts/application/close-account/close-account.handler';
import { OpenAccountHandler } from '@ledger/accounts/application/open-account/open-account.handler';
import { RenameAccountHandler } from '@ledger/accounts/application/rename-account/rename-account.handler';
import { AccountTreeProjector } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { InitializeLedgerHandler } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.handler';
import { LedgerSettingsRepository } from '@ledger/ledger/application/ledger-settings.repository';
import { LedgerSettingsProjector } from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { CommandBus, PolicyCommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { AuthenticatedContextPolicy } from '@ledger/shared-kernel/application/command-bus/policies/authenticated-context.policy';
import { IdempotencyPolicy } from '@ledger/shared-kernel/application/command-bus/policies/idempotency.policy';
import { OptimisticConcurrencyPolicy } from '@ledger/shared-kernel/application/command-bus/policies/optimistic-concurrency.policy';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects';
import { SynchronousProjectionDispatcher } from '@ledger/shared-kernel/infrastructure/adapters/projection/synchronous-dispatcher';
import { AmendPendingTransactionHandler } from '@ledger/transactions/application/amend-transaction/amend-pending-transaction.handler';
import { AnnotateTransactionHandler } from '@ledger/transactions/application/annotate-transaction/annotate-transaction.handler';
import { ConfirmTransactionHandler } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.handler';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { RecordTransactionHandler } from '@ledger/transactions/application/record-transaction/record-transaction.handler';
import { ReverseConfirmedTransactionHandler } from '@ledger/transactions/application/reverse-transaction/reverse-confirmed-transaction.handler';
import { VoidPendingTransactionHandler } from '@ledger/transactions/application/void-transaction/void-pending-transaction.handler';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { AccountBalancesProjector } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { TransactionListProjector } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { createLedgerEventRegistry } from './ledger-event-registry.factory';

/** The wired write side: the command bus plus the projector set for the read side. */
export type LedgerApplication = {
  readonly commandBus: CommandBus;
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
};

/**
 * Composition root for the EP-1 write side. Wires repositories, projectors, the
 * synchronous dispatcher (read-your-writes, RNF-9) and the command bus with its
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
    new AccountBalancesProjector(catalog),
    new LedgerSettingsProjector(),
  ];
  const dispatcher = new SynchronousProjectionDispatcher(projectors, readModel);

  const accounts = new AccountRepository(eventStore, registry, envelopes);
  const transactions = new LedgerTransactionRepository(eventStore, registry, envelopes);
  const settings = new LedgerSettingsRepository(eventStore, registry, envelopes);
  const validation = new AccountValidationService(readModel);

  const commandBus = new PolicyCommandBus([
    new AuthenticatedContextPolicy(),
    new IdempotencyPolicy(eventStore),
    new OptimisticConcurrencyPolicy(),
  ]);

  commandBus.register(
    'InitializeLedger',
    new InitializeLedgerHandler(settings, accounts, idGenerator, clock, dispatcher),
  );
  commandBus.register(
    'OpenAccount',
    new OpenAccountHandler(accounts, readModel, idGenerator, dispatcher),
  );
  commandBus.register('RenameAccount', new RenameAccountHandler(accounts, dispatcher));
  commandBus.register('CloseAccount', new CloseAccountHandler(accounts, dispatcher));
  commandBus.register(
    'RecordTransaction',
    new RecordTransactionHandler(transactions, validation, catalog, balance, idGenerator, dispatcher),
  );
  commandBus.register(
    'ConfirmTransaction',
    new ConfirmTransactionHandler(transactions, clock, dispatcher),
  );
  commandBus.register(
    'AmendPendingTransaction',
    new AmendPendingTransactionHandler(transactions, validation, catalog, balance, dispatcher),
  );
  commandBus.register(
    'AnnotateTransaction',
    new AnnotateTransactionHandler(transactions, dispatcher),
  );
  commandBus.register(
    'VoidPendingTransaction',
    new VoidPendingTransactionHandler(transactions, dispatcher),
  );
  commandBus.register(
    'ReverseConfirmedTransaction',
    new ReverseConfirmedTransactionHandler(transactions, balance, idGenerator, dispatcher),
  );

  return { commandBus, projectors, dispatcher };
}
