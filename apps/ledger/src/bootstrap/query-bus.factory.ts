import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryBus, RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { GetAccountBalancesHandler } from '@ledger/accounts/application/get-account-balances/get-account-balances.handler';
import { GetAccountBalancesQuery } from '@ledger/accounts/application/get-account-balances/get-account-balances.query';
import { GetAccountByIdHandler } from '@ledger/accounts/application/get-account-by-id/get-account-by-id.handler';
import { GetAccountByIdQuery } from '@ledger/accounts/application/get-account-by-id/get-account-by-id.query';
import { GetAccountTreeHandler } from '@ledger/accounts/application/get-account-tree/get-account-tree.handler';
import { GetAccountTreeQuery } from '@ledger/accounts/application/get-account-tree/get-account-tree.query';
import { GetLedgerSettingsHandler } from '@ledger/ledger/application/get-ledger-settings/get-ledger-settings.handler';
import { GetLedgerSettingsQuery } from '@ledger/ledger/application/get-ledger-settings/get-ledger-settings.query';
import {
  ListCurrenciesHandler,
  ListCurrenciesQuery,
} from '@ledger/reference/application/list-currencies.query';
import { GetTransactionByIdHandler } from '@ledger/transactions/application/get-transaction-by-id/get-transaction-by-id.handler';
import { GetTransactionByIdQuery } from '@ledger/transactions/application/get-transaction-by-id/get-transaction-by-id.query';
import { ListPendingReviewHandler } from '@ledger/transactions/application/list-pending-review/list-pending-review.handler';
import { ListPendingReviewQuery } from '@ledger/transactions/application/list-pending-review/list-pending-review.query';
import { ListTransactionsHandler } from '@ledger/transactions/application/list-transactions/list-transactions.handler';
import { ListTransactionsQuery } from '@ledger/transactions/application/list-transactions/list-transactions.query';

/**
 * Composition point where every module's query handlers meet on one bus; each
 * handler lives with the module that owns the read model it serves.
 */
export function createQueryBus(readModel: ReadModelStore): QueryBus {
  const bus = new RegistryQueryBus();

  bus.register(ListTransactionsQuery, new ListTransactionsHandler(readModel));
  bus.register(ListPendingReviewQuery, new ListPendingReviewHandler(readModel));
  bus.register(GetTransactionByIdQuery, new GetTransactionByIdHandler(readModel));
  bus.register(GetAccountTreeQuery, new GetAccountTreeHandler(readModel));
  bus.register(GetAccountByIdQuery, new GetAccountByIdHandler(readModel));
  bus.register(GetAccountBalancesQuery, new GetAccountBalancesHandler(readModel));
  bus.register(GetLedgerSettingsQuery, new GetLedgerSettingsHandler(readModel));
  bus.register(ListCurrenciesQuery, new ListCurrenciesHandler(readModel));

  return bus;
}
