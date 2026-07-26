import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AccountsHttpModule } from '@ledger/accounts/infrastructure/adapters/http';
import { appConfig, databaseConfig } from '@ledger/config/environment';
import { loadEnvironment } from '@ledger/env';
import { LedgerCoreModule } from '@ledger/ledger/ledger-core.module';
import { ReconciliationModule } from '@ledger/reconciliation/reconciliation.module';
import { SharedHttpModule } from '@ledger/shared/infrastructure/adapters/http';
import { TransactionsHttpModule } from '@ledger/transactions/infrastructure/adapters/http';
import { TransactionsModule } from '@ledger/transactions/transactions.module';
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
    // Drives ReconciliationPump's @Interval: the async projections of §8.1.
    ScheduleModule.forRoot(),
    DatabaseModule,
    // Global context guard + resolver binding (RF-26) and the write-result interceptor.
    SharedHttpModule,
    // EP-1 write/read buses wired into DI (in-memory adapters for now; see the
    // module's TODO on swapping in the Postgres persistence adapters).
    LedgerCoreModule,
    // EP-4 (settings, reference, product, reporting): not implemented yet. The
    // first attempt was removed because it targeted shared-kernel APIs that no
    // longer exist; it will be rebuilt story by story on the current core.
    AccountsHttpModule,
    TransactionsHttpModule,
    // EP-3: reconciliation and the transfer feature, mounted on the real core.
    ReconciliationModule,
    TransactionsModule,
  ],
})
export class AppModule {}
