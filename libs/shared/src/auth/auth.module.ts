import { DynamicModule, Module, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApiModule } from '../modules';
import { JWT_STRATEGY_OPTIONS, USERS_SERVICE_CLIENT } from './auth.constants';
import { IdentityResolver, SubjectIdentityResolver } from './identity-resolver';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { discoverJwksUri } from './oidc-discovery';

export interface AuthModuleOptions {
  issuer: string;
  audience: string;
  usersServiceUrl: string;
  identityResolver?: Type<IdentityResolver>;
}

export interface AuthModuleAsyncOptions {
  inject: any[];
  identityResolver?: Type<IdentityResolver>;
  useFactory: (
    ...args: any[]
  ) => Promise<AuthModuleOptions> | AuthModuleOptions;
}

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return AuthModule.build({
      imports: [
        ApiModule.register({
          name: USERS_SERVICE_CLIENT,
          baseURL: options.usersServiceUrl,
        }),
      ],
      strategyOptionsProvider: {
        provide: JWT_STRATEGY_OPTIONS,
        useFactory: async () => ({
          issuer: options.issuer,
          audience: options.audience,
          jwksUri: await discoverJwksUri(options.issuer),
        }),
      },
      identityResolver: options.identityResolver,
    });
  }

  static forRootAsync(asyncOptions: AuthModuleAsyncOptions): DynamicModule {
    return AuthModule.build({
      imports: [
        ApiModule.registerAsync({
          name: USERS_SERVICE_CLIENT,
          inject: asyncOptions.inject,
          useFactory: async (...args: any[]) => {
            const options = await asyncOptions.useFactory(...args);
            return { baseURL: options.usersServiceUrl };
          },
        }),
      ],
      strategyOptionsProvider: {
        provide: JWT_STRATEGY_OPTIONS,
        inject: asyncOptions.inject,
        useFactory: async (...args: any[]) => {
          const options = await asyncOptions.useFactory(...args);
          return {
            issuer: options.issuer,
            audience: options.audience,
            jwksUri: await discoverJwksUri(options.issuer),
          };
        },
      },
      identityResolver: asyncOptions.identityResolver,
    });
  }

  private static build(config: {
    imports: DynamicModule['imports'];
    strategyOptionsProvider: any;
    identityResolver?: Type<IdentityResolver>;
  }): DynamicModule {
    return {
      module: AuthModule,
      imports: [PassportModule.register({}), ...config.imports],
      providers: [
        config.strategyOptionsProvider,
        {
          provide: IdentityResolver,
          useClass: config.identityResolver ?? SubjectIdentityResolver,
        },
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    };
  }
}
