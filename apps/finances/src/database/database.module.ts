import { Global, Module } from '@nestjs/common';
import { DatabaseModule as SharedDatabaseModule } from '@shared';
import { databaseConfig } from '@app/config/environment';

/**
 * Finances' database wiring: delegates to the shared module with this app's
 * `database` config namespace and migration glob.
 */
@Global()
@Module({
  imports: [
    SharedDatabaseModule.forRoot({
      configKey: databaseConfig.KEY,
      migrations: ['dist/apps/finances/database/migrations/*.js'],
    }),
  ],
})
export class DatabaseModule {}
