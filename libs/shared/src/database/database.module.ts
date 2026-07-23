import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseModuleOptions } from './database-module-options.type';

/** The subset of an app's `database` config namespace the module consumes. */
interface DatabaseNamespace {
  readonly type: string;
  readonly url: string;
  readonly synchronize: boolean;
}

/**
 * Shared TypeORM wiring: each app injects its own `database` config namespace
 * and migration glob, so a single module serves both finances and ledger.
 * `timestamp` columns are forced to `timestamptz` so persisted instants keep
 * their time zone.
 */
@Global()
@Module({})
export class DatabaseModule {
  /** Wires TypeOrmModule.forRootAsync from the app's `database` config namespace. */
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [options.configKey],
          useFactory: (db: DatabaseNamespace): TypeOrmModuleOptions => ({
            type: db.type as TypeOrmModuleOptions['type'],
            url: db.url,
            synchronize: db.synchronize,
            autoLoadEntities: options.autoLoadEntities ?? true,
            entities: options.entities ?? [],
            migrations: [...options.migrations],
            debug: true,
            extra: {
              columnTypes: {
                timestamp: 'timestamp with time zone',
              },
            },
          }),
        }),
      ],
    };
  }
}
