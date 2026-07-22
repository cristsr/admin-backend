import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Readiness probe for the OIDC provider: fetches the JWKS endpoint the JWT
 * strategy verifies tokens against, bounded by a timeout so a slow IdP never
 * stalls the probe. The endpoint is discovered once at bootstrap, so the probe
 * only checks reachability, not re-discovery.
 */
export class OidcHealthIndicator extends HealthIndicator {
  constructor(
    private readonly jwksUri: string,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  async isHealthy(key = 'oidc'): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.jwksUri, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`jwks endpoint responded ${response.status}`);
      }

      return this.getStatus(key, true);
    } catch (error) {
      const message = controller.signal.aborted
        ? `oidc readiness timeout after ${this.timeoutMs}ms`
        : String((error as Error).message);

      return this.getStatus(key, false, { message });
    } finally {
      clearTimeout(timer);
    }
  }
}
