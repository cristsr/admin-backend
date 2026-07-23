import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, databaseConfig } from '@ledger/config/environment';
import { loadEnvironment } from '@ledger/env';
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
  ],
})
export class AppModule {}
