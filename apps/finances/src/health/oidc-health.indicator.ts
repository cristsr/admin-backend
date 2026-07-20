import { Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE, OidcDiscoveryCache } from '@shared';

/**
 * Readiness probe for the OIDC provider. Reuses the same lazy discovery cache
 * that backs the `JwtStrategy`: a successful readiness warms up the cache, so
 * the first real token validation never pays the discovery cost, and the IdP
 * being unreachable at boot never blocks startup (AC-2 + AC-3). The check is
 * bounded by a short timeout so a slow IdP does not stall the readiness
 * endpoint.
 */
export class OidcHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(OIDC_DISCOVERY_CACHE) private readonly discovery: OidcDiscoveryCache,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  async isHealthy(key = 'oidc'): Promise<HealthIndicatorResult> {
    const probe = this.discovery.getJwksUri();

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(`oidc discovery timeout after ${this.timeoutMs}ms`),
          ),
        this.timeoutMs,
      );
    });

    try {
      await Promise.race([probe, timeout]);
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, {
        message: String((error as Error).message),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
