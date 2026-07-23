import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AccountsHttpModule } from '@ledger/accounts/infrastructure/adapters/http';
import { appConfig, databaseConfig } from '@ledger/config/environment';
import { loadEnvironment } from '@ledger/env';
import { AssumedEp1BusModule } from '@ledger/shared/application/ep1-contracts.assumed';
import { SharedHttpModule } from '@ledger/shared/infrastructure/adapters/http';
import { TransactionsHttpModule } from '@ledger/transactions/infrastructure/adapters/http';
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
    // ASSUMED EP-1: placeholder command/query buses so the graph resolves without
    // the core. Replaced by EP-1's real bus module at integration.
    AssumedEp1BusModule,
    AccountsHttpModule,
    TransactionsHttpModule,
  ],
})
export class AppModule {}
