import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AccountsHttpModule } from '@ledger/accounts/infrastructure/adapters/http';
import { appConfig, databaseConfig } from '@ledger/config/environment';
import { loadEnvironment } from '@ledger/env';
import { LedgerCoreModule } from '@ledger/ledger/ledger-core.module';
import { ReconciliationModule } from '@ledger/reconciliation/reconciliation.module';
import { SharedHttpModule } from '@ledger/shared/infrastructure/adapters/http';
import { TransactionsHttpModule } from '@ledger/transactions/infrastructure/adapters/http';
import { TransactionsModule } from '@ledger/transactions/transactions.module';
import { SettingsModule } from '@ledger/settings/settings.module';
import { ReferenceModule } from '@ledger/reference/reference.module';
import { ProductModule } from '@ledger/product/product.module';
import { ReportingModule } from '@ledger/reporting/reporting.module';
import { buildPinoModuleOptions } from './config/logger/logger.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: 'apps/ledger/.env',
      load: [appConfig, databaseConfig],
      validate: () => loadEnvironment(),
    }),
    LoggerModule.forRoot(buildPinoModuleOptions()),
    DatabaseModule,
    // Global context guard + resolver binding (RF-26) and the write-result interceptor.
    SharedHttpModule,
    // EP-1 write/read buses wired into DI (in-memory adapters for now; see the
    // module's TODO on swapping in the Postgres persistence adapters).
    LedgerCoreModule,
    // EP-4.1: LedgerSettings (presentation currency + timezone management)
    SettingsModule,
    // EP-4.2: Reference data (currencies, prices)
    ReferenceModule,
    // EP-4.3/4.4: Product layer (budgets, goals)
    ProductModule,
    // EP-4.5/4.6: Reporting (net worth, expenses)
    ReportingModule,
    AccountsHttpModule,
    TransactionsHttpModule,
    // EP-3: reconciliation and the transfer feature, mounted on the real core.
    ReconciliationModule,
    TransactionsModule,
  ],
})
export class AppModule {}
