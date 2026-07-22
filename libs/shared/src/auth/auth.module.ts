import { ConfigurableModuleBuilder, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AUTH_MODULE_OPTIONS, JWT_STRATEGY_OPTIONS } from './constants/auth.constants';
import { discoverOidcMetadata } from './functions/oidc-metadata';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IdentityResolver, SubjectIdentityResolver } from './resolvers/identity-resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthModuleExtras } from './types/auth-module-extras.type';
import { AuthModuleOptions } from './types/auth-module-options.type';
import { JwtStrategyOptions } from './types/jwt-strategy-options.type';

const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<AuthModuleOptions>({
  optionsInjectionToken: AUTH_MODULE_OPTIONS,
})
  .setClassMethodName('forRoot')
  .setExtras<AuthModuleExtras>({}, (definition, extras) => ({
    ...definition,
    // Global so the strategy and guard apply application-wide.
    global: true,
    // Preserve caller-supplied imports (e.g. the module binding the
    // AuthenticatedUserProvider port) alongside Passport.
    imports: [...(definition.imports ?? []), PassportModule.register({})],
    providers: [
      ...(definition.providers ?? []),
      {
        provide: JWT_STRATEGY_OPTIONS,
        // Discovery runs once here; the strategy receives a static JWKS URI.
        useFactory: async (options: AuthModuleOptions): Promise<JwtStrategyOptions> => {
          const metadata = await discoverOidcMetadata(options.issuer, options.audience);

          return {
            issuer: metadata.issuer,
            audience: options.audience,
            jwksUri: metadata.jwksUri,
          };
        },
        inject: [AUTH_MODULE_OPTIONS],
      },
      {
        provide: IdentityResolver,
        useClass: extras.identityResolver ?? SubjectIdentityResolver,
      },
      JwtStrategy,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
    // Exposed so readiness probes can reach the discovered JWKS endpoint.
    exports: [JWT_STRATEGY_OPTIONS],
  }))
  .build();

@Module({})
export class AuthModule extends ConfigurableModuleClass {}
