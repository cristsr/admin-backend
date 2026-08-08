import { Module } from '@nestjs/common';
import { AccountBalanceFinder } from './application/ports/account-balance-finder.port';
import { AccountConstraintsReader } from './application/ports/account-constraints-reader.port';
import { AccountNameReader } from './application/ports/account-name-reader.port';
import { AccountTreeFinder } from './application/ports/account-tree-finder.port';
import { AccountsHttpModule } from './infrastructure/adapters/http';
import { ReadModelAccountBalanceFinder } from './infrastructure/adapters/persistence/read-model-account-balance-finder';
import { ReadModelAccountConstraintsReader } from './infrastructure/adapters/persistence/read-model-account-constraints-reader';
import { ReadModelAccountNameReader } from './infrastructure/adapters/persistence/read-model-account-name-reader';
import { ReadModelAccountTreeFinder } from './infrastructure/adapters/persistence/read-model-account-tree-finder';

/**
 * The accounts module.
 *
 * Its command and query handlers are still composed in the application's
 * `bootstrap/` root and reached through the shared buses. What it does own is
 * the binding of its read ports to the adapters that serve them — the only
 * place that may know both — so anything injecting an `AccountTreeFinder`
 * resolves it here rather than reaching for the read model itself.
 */
@Module({
  imports: [AccountsHttpModule],
  providers: [
    { provide: AccountTreeFinder, useClass: ReadModelAccountTreeFinder },
    { provide: AccountBalanceFinder, useClass: ReadModelAccountBalanceFinder },
    { provide: AccountConstraintsReader, useClass: ReadModelAccountConstraintsReader },
    { provide: AccountNameReader, useClass: ReadModelAccountNameReader },
  ],
  exports: [
    AccountTreeFinder,
    AccountBalanceFinder,
    AccountConstraintsReader,
    AccountNameReader,
  ],
})
export class AccountsModule {}
