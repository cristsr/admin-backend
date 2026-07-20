import { Nullable } from '../types/nullable.type';
import { discoverJwksUri } from './oidc-discovery';
import { OidcDiscoveryCacheEntry } from './oidc-discovery-cache-entry.type';
import { OidcDiscoveryCacheOptions } from './oidc-discovery-cache-options.type';

/**
 * Lazily resolves and TTL-caches the JWKS endpoint. Concurrent callers share
 * one discovery round-trip; a failure clears the inflight so the next call retries.
 */
export class OidcDiscoveryCache {
  private entry: Nullable<OidcDiscoveryCacheEntry> = null;
  private inflight: Nullable<Promise<string>> = null;

  private readonly discoverer: (issuer: string) => Promise<string>;

  constructor(private readonly options: OidcDiscoveryCacheOptions) {
    const { discoverer } = options;
    this.discoverer = discoverer ?? discoverJwksUri;
  }

  getJwksUri(): Promise<string> {
    const now = Date.now();
    if (this.entry && this.entry.expiresAt > now) {
      return Promise.resolve(this.entry.jwksUri);
    }

    if (!this.inflight) {
      const inflight = this.discoverer(this.options.issuer)
        .then((jwksUri: string) => {
          this.entry = {
            jwksUri,
            expiresAt: Date.now() + this.options.ttlMs,
          };
          this.inflight = null;
          return jwksUri;
        })
        .catch((error: unknown) => {
          this.inflight = null;
          throw error;
        });

      this.inflight = inflight;
    }

    return this.inflight;
  }
}