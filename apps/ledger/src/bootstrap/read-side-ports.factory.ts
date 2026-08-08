import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { AccountBalanceFinder } from '@ledger/accounts/application/ports/account-balance-finder.port';
import { AccountConstraintsReader } from '@ledger/accounts/application/ports/account-constraints-reader.port';
import { AccountNameReader } from '@ledger/accounts/application/ports/account-name-reader.port';
import { AccountTreeFinder } from '@ledger/accounts/application/ports/account-tree-finder.port';
import { ReadModelAccountBalanceFinder } from '@ledger/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder';
import { ReadModelAccountConstraintsReader } from '@ledger/accounts/infrastructure/adapters/persistence/read-model-account-constraints-reader';
import { ReadModelAccountNameReader } from '@ledger/accounts/infrastructure/adapters/persistence/read-model-account-name-reader';
import { ReadModelAccountTreeFinder } from '@ledger/accounts/infrastructure/adapters/persistence/read-model-account-tree-finder';

/**
 * The read ports serving the API, handed to the query bus.
 *
 * Split from {@link WriteSideReadPorts} along the same line the port names draw:
 * a `Finder` answers a query handler with a view, a `Reader`/`Lookup` answers
 * the write side with facts. No composition needs both sets.
 */
export type QueryPorts = {
  readonly accountTree: AccountTreeFinder;
  readonly accountBalances: AccountBalanceFinder;
  // Completed by the `transactions`, `ledger` and `reference` phases.
};

/** The read ports serving command handlers and application services. */
export type WriteSideReadPorts = {
  readonly accountConstraints: AccountConstraintsReader;
  readonly accountNames: AccountNameReader;
  // `SystemAccountLookup` joins in the `ledger` phase.
};

/**
 * Store-backed composition, which is what both the PostgreSQL wiring and the
 * in-memory ones use: every adapter here reads through {@link ReadModelStore},
 * so an `InMemoryReadModelStore` needs no test double of its own.
 *
 * A port whose adapter needs more than the store — a join, a subquery — is
 * substituted afterwards by the module that binds it, rather than making this
 * factory depend on a `DataSource` nobody else needs.
 */
export function createQueryPorts(readModel: ReadModelStore): QueryPorts {
  return {
    accountTree: new ReadModelAccountTreeFinder(readModel),
    accountBalances: new ReadModelAccountBalanceFinder(readModel),
  };
}

export function createWriteSideReadPorts(readModel: ReadModelStore): WriteSideReadPorts {
  return {
    accountConstraints: new ReadModelAccountConstraintsReader(readModel),
    accountNames: new ReadModelAccountNameReader(readModel),
  };
}
