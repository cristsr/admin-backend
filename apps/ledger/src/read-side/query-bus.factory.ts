import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryBus, RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { ListCurrenciesHandler } from '@ledger/reference/application/list-currencies.query';
import { GetAccountBalancesHandler } from './get-account-balances/get-account-balances.handler';
import { GetAccountByIdHandler } from './get-account-by-id/get-account-by-id.handler';
import { GetAccountTreeHandler } from './get-account-tree/get-account-tree.handler';
import { GetLedgerSettingsHandler } from './get-ledger-settings/get-ledger-settings.handler';
import { GetTransactionByIdHandler } from './get-transaction-by-id/get-transaction-by-id.handler';
import { ListPendingReviewHandler } from './list-pending-review/list-pending-review.handler';
import { ListTransactionsHandler } from './list-transactions/list-transactions.handler';

/** Wires the read-side query bus over a {@link ReadModelStore}. */
export function createQueryBus(readModel: ReadModelStore): QueryBus {
  const bus = new RegistryQueryBus();

  bus.register('ListTransactions', new ListTransactionsHandler(readModel));
  bus.register('ListPendingReview', new ListPendingReviewHandler(readModel));
  bus.register('GetTransactionById', new GetTransactionByIdHandler(readModel));
  bus.register('GetAccountTree', new GetAccountTreeHandler(readModel));
  bus.register('GetAccountById', new GetAccountByIdHandler(readModel));
  bus.register('GetAccountBalances', new GetAccountBalancesHandler(readModel));
  bus.register('GetLedgerSettings', new GetLedgerSettingsHandler(readModel));
  bus.register('ListCurrencies', new ListCurrenciesHandler(readModel));

  return bus;
}
