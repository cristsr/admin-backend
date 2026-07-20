import { ConfigurableModuleBuilder, Module, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { createApiClientProvider } from '../modules';
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

/** Default discovery cache lifetime: re-resolve the JWKS endpoint hourly. */
const DEFAULT_DISCOVERY_TTL_MS = 60 * 60 * 1000;

export interface AuthModuleOptions {
  issuer: string;
  audience: string;
  usersServiceUrl: string;
  discoveryTtlMs?: number;
}

interface AuthModuleExtras {
  /**
   * How an external identity is read out of the token payload. Supplied at
   * registration time rather than resolved asynchronously, because the class
   * has to be known before DI runs. Defaults to reading `sub`.
   */
  identityResolver?: Type<IdentityResolver>;
}

const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<AuthModuleOptions>({
  optionsInjectionToken: AUTH_MODULE_OPTIONS,
})
  .setClassMethodName('forRoot')
  .setExtras<AuthModuleExtras>({}, (definition, extras) => ({
    ...definition,
    // Global so the shared OIDC discovery cache is injectable elsewhere (the
    // health check) without re-importing this module and building a second
    // cache that would discover all over again.
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

/**
 * Bearer-token authentication against an OpenID Connect issuer. Registers the
 * JWT strategy, the global guard and the lazily-resolved JWKS discovery, and
 * exposes the authenticated user through the configured identity resolver.
 *
 * `forRoot`/`forRootAsync` and every options shape they accept are generated
 * by Nest; the async factory now runs once and feeds all three derived
 * providers, instead of being invoked separately by each of them.
 */
@Module({})
export class AuthModule extends ConfigurableModuleClass {}
