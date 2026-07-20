import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE, OidcDiscoveryCache } from '@shared';
import { HealthController } from './health.controller';
import { OidcHealthIndicator } from './oidc-health.indicator';

/**
 * Readiness timeout for the OIDC probe (AC-2). Bounded so a slow IdP never
 * stalls the orchestrator's health check loop.
 */
const OIDC_READINESS_TIMEOUT_MS = 2_000;

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: OidcHealthIndicator,
      useFactory: (discovery: OidcDiscoveryCache) =>
        new OidcHealthIndicator(discovery, OIDC_READINESS_TIMEOUT_MS),
      inject: [OIDC_DISCOVERY_CACHE],
    },
  ],
})
export class HealthModule {}
