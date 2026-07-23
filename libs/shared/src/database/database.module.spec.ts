import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
// Internal of @nestjs/typeorm: the provider built by `forRootAsync` lives
// under this token, which the package does not re-export publicly.
import { TYPEORM_MODULE_OPTIONS } from '@nestjs/typeorm/dist/typeorm.constants';
import { DatabaseModule } from './database.module';

const dbNamespace = {
  type: 'postgres',
  url: 'postgres://user:pass@localhost:5432/ledger',
  synchronize: false,
};

/**
 * The option subset the assertions care about. The factory's declared return
 * is a per-driver union, so single-driver properties like `url` are read
 * through this shape instead.
 */
interface BuiltOptions {
  type: string;
  url: string;
  synchronize: boolean;
  autoLoadEntities: boolean;
  migrations: string[];
  extra: { columnTypes: { timestamp: string } };
}

/**
 * Extracts the TypeORM options factory from the dynamic module tree:
 * `DatabaseModule.forRoot` → `TypeOrmModule` → `TypeOrmCoreModule`, which is
 * where the options provider lives.
 */
function optionsProviderOf(
  moduleDef: DynamicModule,
): FactoryProvider<TypeOrmModuleOptions | Promise<TypeOrmModuleOptions>> {
  const typeOrmModule = moduleDef.imports?.[0] as DynamicModule;
  const coreModule = typeOrmModule.imports?.[0] as DynamicModule;

  return (coreModule.providers as FactoryProvider[]).find(
    (provider) => provider.provide === TYPEORM_MODULE_OPTIONS,
  );
}

function buildOptions(moduleDef: DynamicModule): BuiltOptions {
  return optionsProviderOf(moduleDef).useFactory(dbNamespace) as unknown as BuiltOptions;
}

describe('DatabaseModule', () => {
  it('builds TypeORM options from the injected database namespace', () => {
    const moduleDef = DatabaseModule.forRoot({ configKey: 'database', migrations: [] });

    expect(optionsProviderOf(moduleDef).inject).toEqual(['database']);

    const options = buildOptions(moduleDef);

    expect(options.type).toBe('postgres');
    expect(options.url).toBe(dbNamespace.url);
    expect(options.synchronize).toBe(false);
    expect(options.autoLoadEntities).toBe(true);
  });

  it('applies the timestamptz column-type override', () => {
    const moduleDef = DatabaseModule.forRoot({ configKey: 'database', migrations: [] });

    expect(buildOptions(moduleDef).extra).toEqual({
      columnTypes: { timestamp: 'timestamp with time zone' },
    });
  });

  it('registers the migrations glob passed by the app', () => {
    const migrations = ['dist/apps/ledger/database/migrations/*.js'];
    const moduleDef = DatabaseModule.forRoot({ configKey: 'database', migrations });

    expect(buildOptions(moduleDef).migrations).toEqual(migrations);
  });
});
