import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE, OidcDiscoveryCache } from '@shared';
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
      useFactory: (discovery: OidcDiscoveryCache) =>
        new OidcHealthIndicator(discovery, OIDC_READINESS_TIMEOUT_MS),
      inject: [OIDC_DISCOVERY_CACHE],
    },
  ],
})
export class HealthModule {}
