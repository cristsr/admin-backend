import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { QueryBus, RegistryQueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { GetAccountBalancesHandler } from './get-account-balances/get-account-balances.handler';
import { GetAccountByIdHandler } from './get-account-by-id/get-account-by-id.handler';
import { GetAccountTreeHandler } from './get-account-tree/get-account-tree.handler';
import { GetLedgerSettingsHandler } from './get-ledger-settings/get-ledger-settings.handler';
import { GetTransactionByIdHandler } from './get-transaction-by-id/get-transaction-by-id.handler';
import { ListTransactionsHandler } from './list-transactions/list-transactions.handler';

/** Wires the read-side query bus over a {@link ReadModelStore}. */
export function createQueryBus(readModel: ReadModelStore): QueryBus {
  const bus = new RegistryQueryBus();

  bus.register('ListTransactions', new ListTransactionsHandler(readModel));
  bus.register('GetTransactionById', new GetTransactionByIdHandler(readModel));
  bus.register('GetAccountTree', new GetAccountTreeHandler(readModel));
  bus.register('GetAccountById', new GetAccountByIdHandler(readModel));
  bus.register('GetAccountBalances', new GetAccountBalancesHandler(readModel));
  bus.register('GetLedgerSettings', new GetLedgerSettingsHandler(readModel));

  return bus;
}
