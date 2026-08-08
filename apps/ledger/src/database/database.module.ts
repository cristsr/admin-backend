import { Global, Module } from '@nestjs/common';
import { DatabaseModule as SharedDatabaseModule } from '@shared';
import { databaseConfig } from '@ledger/config/environment';

/**
 * Ledger's database wiring: delegates to the shared module with this app's
 * `database` config namespace and migration glob. Event store and read
 * projections share one Postgres connection.
 */
@Global()
@Module({
  imports: [
    SharedDatabaseModule.forRoot({
      configKey: databaseConfig.KEY,
      migrations: ['dist/apps/ledger/database/migrations/*.js'],
    }),
  ],
})
export class DatabaseModule {}
