import { discoverJwksUri } from './oidc-discovery';

/**
 * Lazily-resolved and TTL-cached OpenID Connect discovery document. Mirrors
 * the lazy + cache behaviour already used by `jwks-rsa` for the signing keys:
 * the JWKS endpoint is resolved on the first token validation (not at app
 * bootstrap), cached with a TTL, and re-resolved on expiry so an IdP-side
 * rotation (a new `jwks_uri`) is absorbed without restarting the process
 * (AC-3).
 */
export interface OidcDiscoveryCacheOptions {
  /** Issuer URL (no trailing slash). */
  readonly issuer: string;
  /** Cache lifetime in ms. After expiry, the next call re-resolves. */
  readonly ttlMs: number;
  /**
   * Discovery function — defaults to {@link discoverJwksUri} in production
   * but injected here so the cache (and its tests) stay decoupled from the
   * network.
   */
  readonly discoverer?: (issuer: string) => Promise<string>;
}

interface Entry {
  readonly jwksUri: string;
  readonly expiresAt: number;
}

/**
 * Resolves the JWKS endpoint via the standard OpenID Connect discovery
 * document and caches the result with a TTL. Resolution is deferred to the
 * first call (lazy) and concurrent callers are coalesced into a single
 * discovery round-trip. On failure the inflight is cleared so the next call
 * retries instead of staying stuck (AC-3).
 */
export class OidcDiscoveryCache {
  private entry: Entry | null = null;
  private inflight: Promise<string> | null = null;

  private readonly discoverer: (issuer: string) => Promise<string>;

  constructor(private readonly options: OidcDiscoveryCacheOptions) {
    const { discoverer } = options;
    this.discoverer = discoverer ?? discoverJwksUri;
  }

  /**
   * Returns the cached JWKS endpoint, or resolves it now (coalescing any
   * concurrent callers). Throws if the discoverer fails — the inflight is
   * cleared so the next call retries instead of staying stuck.
   */
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