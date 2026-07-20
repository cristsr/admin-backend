import { ConfigurableModuleBuilder, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { createApiClientProvider } from '../modules';
import { AuthModuleExtras } from './auth-module-extras.type';
import { AuthModuleOptions } from './auth-module-options.type';
import {
  AUTH_MODULE_OPTIONS,
  JWT_STRATEGY_OPTIONS,
  OIDC_DISCOVERY_CACHE,
  USERS_SERVICE_CLIENT,
} from './auth.constants';
import { IdentityResolver, SubjectIdentityResolver } from './identity-resolver';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { discoverJwksUri } from './oidc-discovery';
import { OidcDiscoveryCache } from './oidc-discovery-cache';

const DEFAULT_DISCOVERY_TTL_MS = 60 * 60 * 1000;

const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<AuthModuleOptions>({
  optionsInjectionToken: AUTH_MODULE_OPTIONS,
})
  .setClassMethodName('forRoot')
  .setExtras<AuthModuleExtras>({}, (definition, extras) => ({
    ...definition,
    // Global so the discovery cache is injectable elsewhere without a second one.
    global: true,
    imports: [PassportModule.register({})],
    providers: [
      ...(definition.providers ?? []),
      createApiClientProvider<AuthModuleOptions>({
        provide: USERS_SERVICE_CLIENT,
        inject: [AUTH_MODULE_OPTIONS],
        useFactory: (options) => ({ baseURL: options.usersServiceUrl }),
      }),
      {
        provide: JWT_STRATEGY_OPTIONS,
        useFactory: (options: AuthModuleOptions) => ({
          issuer: options.issuer,
          audience: options.audience,
        }),
        inject: [AUTH_MODULE_OPTIONS],
      },
      {
        provide: OIDC_DISCOVERY_CACHE,
        useFactory: (options: AuthModuleOptions) =>
          new OidcDiscoveryCache({
            issuer: options.issuer,
            ttlMs: options.discoveryTtlMs ?? DEFAULT_DISCOVERY_TTL_MS,
            discoverer: discoverJwksUri,
          }),
        inject: [AUTH_MODULE_OPTIONS],
      },
      {
        provide: IdentityResolver,
        useClass: extras.identityResolver ?? SubjectIdentityResolver,
      },
      JwtStrategy,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
    exports: [OIDC_DISCOVERY_CACHE],
  }))
  .build();

@Module({})
export class AuthModule extends ConfigurableModuleClass {}
