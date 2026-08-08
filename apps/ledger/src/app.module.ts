import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AccountsModule } from '@ledger/accounts/accounts.module';
import { appConfig, databaseConfig } from '@ledger/config/environment';
import { loadEnvironment } from '@ledger/env';
import { LedgerHttpModule } from '@ledger/ledger/infrastructure/adapters/http';
import { LedgerCoreModule } from '@ledger/ledger/ledger-core.module';
import { ReconciliationModule } from '@ledger/reconciliation/reconciliation.module';
import { ReferenceModule } from '@ledger/reference/reference.module';
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
    // Drives the reconciliation pump's @Interval.
    ScheduleModule.forRoot(),
    DatabaseModule,
    // Global context guard, resolver binding and the write-result interceptor.
    SharedHttpModule,
    // Composition root: the buses every other module resolves.
    LedgerCoreModule,
    ReferenceModule,
    LedgerHttpModule,
    AccountsModule,
    TransactionsHttpModule,
    ReconciliationModule,
    TransactionsModule,
  ],
})
export class AppModule {}
