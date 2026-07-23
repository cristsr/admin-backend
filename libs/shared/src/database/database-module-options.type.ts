import { InjectionToken } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/** Options an app supplies so one DatabaseModule serves both finances and ledger. */
export interface DatabaseModuleOptions {
  /** Token of the app's `database` config namespace (the KEY of its `registerAs`). */
  readonly configKey: InjectionToken;
  /** Glob(s) of compiled migration files, resolved by TypeORM at runtime. */
  readonly migrations: readonly string[];
  /** Explicit entities; apps usually rely on `autoLoadEntities` instead. */
  readonly entities?: TypeOrmModuleOptions['entities'];
  /** Discover entities from `forFeature` registrations; defaults to true. */
  readonly autoLoadEntities?: boolean;
}
