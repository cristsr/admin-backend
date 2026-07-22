import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { JWT_STRATEGY_OPTIONS, JwtStrategyOptions } from '@shared';
import { HealthController } from './health.controller';
import { OidcHealthIndicator } from './oidc-health.indicator';

/** Bounded so a slow IdP never stalls the readiness probe. */
const OIDC_READINESS_TIMEOUT_MS = 2_000;

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: OidcHealthIndicator,
      useFactory: (options: JwtStrategyOptions) =>
        new OidcHealthIndicator(options.jwksUri, OIDC_READINESS_TIMEOUT_MS),
      inject: [JWT_STRATEGY_OPTIONS],
    },
  ],
})
export class HealthModule {}
