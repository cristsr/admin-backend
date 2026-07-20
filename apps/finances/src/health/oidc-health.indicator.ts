import { Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE, OidcDiscoveryCache } from '@shared';

/**
 * Readiness probe for the OIDC provider. Reuses the JwtStrategy's discovery
 * cache, so a successful probe warms it up for the first token validation.
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
