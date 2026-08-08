import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { GetAccountBalancesHandler } from '@ledger/accounts/application/usecases/get-account-balances/get-account-balances.handler';
import { GetAccountBalancesQuery } from '@ledger/accounts/application/usecases/get-account-balances/get-account-balances.query';
import { GetAccountByIdHandler } from '@ledger/accounts/application/usecases/get-account-by-id/get-account-by-id.handler';
import { GetAccountByIdQuery } from '@ledger/accounts/application/usecases/get-account-by-id/get-account-by-id.query';
import { GetAccountTreeHandler } from '@ledger/accounts/application/usecases/get-account-tree/get-account-tree.handler';
import { GetAccountTreeQuery } from '@ledger/accounts/application/usecases/get-account-tree/get-account-tree.query';
import { GetLedgerSettingsHandler } from '@ledger/ledger/application/usecases/get-ledger-settings/get-ledger-settings.handler';
import { GetLedgerSettingsQuery } from '@ledger/ledger/application/usecases/get-ledger-settings/get-ledger-settings.query';
import { ListCurrenciesHandler } from '@ledger/reference/application/usecases/list-currencies/list-currencies.handler';
import { ListCurrenciesQuery } from '@ledger/reference/application/usecases/list-currencies/list-currencies.query';
import { GetTransactionByIdHandler } from '@ledger/transactions/application/usecases/get-transaction-by-id/get-transaction-by-id.handler';
import { GetTransactionByIdQuery } from '@ledger/transactions/application/usecases/get-transaction-by-id/get-transaction-by-id.query';
import { ListPendingReviewHandler } from '@ledger/transactions/application/usecases/list-pending-review/list-pending-review.handler';
import { ListPendingReviewQuery } from '@ledger/transactions/application/usecases/list-pending-review/list-pending-review.query';
import { ListTransactionsHandler } from '@ledger/transactions/application/usecases/list-transactions/list-transactions.handler';
import { ListTransactionsQuery } from '@ledger/transactions/application/usecases/list-transactions/list-transactions.query';
import { QueryPorts, createQueryPorts } from './read-side-ports.factory';

/**
 * Composition point where every module's query handlers meet on one bus; each
 * handler lives with the module that owns the read model it serves.
 *
 * `ports` defaults to the store-backed composition, so every caller keeps
 * working while the migration proceeds module by module. Passing it explicitly
 * is how a module substitutes an adapter the shared store cannot serve.
 *
 * Returns the concrete bus, not the `QueryBus` abstraction: feature modules
 * composed outside this root — `reconciliation`, whose read port is bound in its
 * own module — register their handlers on this very instance at init, the same
 * way they do on `PolicyCommandBus` for writes.
 */
export function createQueryBus(
  readModel: ReadModelStore,
  ports: QueryPorts = createQueryPorts(readModel),
): RegistryQueryBus {
  const bus = new RegistryQueryBus();

  // Still store-backed: their ports arrive with the `transactions`, `ledger` and
  // `reference` phases, after which `readModel` leaves this signature.
  bus.register(ListTransactionsQuery, new ListTransactionsHandler(readModel));
  bus.register(ListPendingReviewQuery, new ListPendingReviewHandler(readModel));
  bus.register(GetTransactionByIdQuery, new GetTransactionByIdHandler(readModel));
  bus.register(GetLedgerSettingsQuery, new GetLedgerSettingsHandler(readModel));
  bus.register(ListCurrenciesQuery, new ListCurrenciesHandler(readModel));

  bus.register(GetAccountTreeQuery, new GetAccountTreeHandler(ports.accountTree));
  bus.register(GetAccountByIdQuery, new GetAccountByIdHandler(ports.accountTree));
  bus.register(GetAccountBalancesQuery, new GetAccountBalancesHandler(ports.accountBalances));

  return bus;
}
