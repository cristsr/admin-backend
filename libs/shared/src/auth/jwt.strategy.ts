import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, map } from 'rxjs';
import {
  JWT_STRATEGY_OPTIONS,
  OIDC_DISCOVERY_CACHE,
  USERS_SERVICE_CLIENT,
} from './auth.constants';
import { AuthenticatedUser } from './authenticated-user.type';
import { IdentityResolver } from './identity-resolver';
import { OidcDiscoveryCache } from './oidc-discovery-cache';

export interface JwtStrategyOptions {
  issuer: string;
  audience: string;
  /** Kept for backwards-compatibility; ignored when {@link discovery} is set. */
  jwksUri?: string;
  /**
   * Lazy discovery cache. When set, the JWKS endpoint is resolved on the first
   * token validation instead of at bootstrap.
   */
  discovery?: OidcDiscoveryCache;
}

/**
 * JWKS resolution driven lazily by the {@link OidcDiscoveryCache}. The
 * `jwks-rsa` client stays cached and keyed by the resolved `jwks_uri`; if the
 * cache re-resolves a different URI after TTL expiry (an IdP-side rotation),
 * the client is rebuilt transparently. App bootstrap no longer hits the IdP,
 * so the service starts even when the provider is momentarily unreachable
 * (AC-3).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private jwksClient: ReturnType<typeof passportJwtSecret> | null = null;
  private resolvedJwksUri: string | null = null;
  private readonly discovery?: OidcDiscoveryCache;
  private readonly fallbackJwksUri: string;

  constructor(
    @Inject(USERS_SERVICE_CLIENT) private readonly httpClient: HttpService,
    @Inject(JWT_STRATEGY_OPTIONS) options: JwtStrategyOptions,
    private readonly identityResolver: IdentityResolver,
    @Inject(OIDC_DISCOVERY_CACHE) injectedDiscovery?: OidcDiscoveryCache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: (request: any, rawJwtToken: any, done: any) =>
        this.secretOrKeyProvider(request, rawJwtToken, done),
      audience: options.audience,
      issuer: options.issuer,
      algorithms: ['RS256'],
    });

    // The discovery cache is injected via DI but can also be supplied inline
    // through the options (used by unit tests); the inline value wins.
    this.discovery = options.discovery ?? injectedDiscovery;
    this.fallbackJwksUri = options.jwksUri ?? '';
  }

  /**
   * Resolves the signing key for each incoming token. The JWKS endpoint is
   * discovered lazily on first use, so a slow or unreachable IdP never blocks
   * startup — only the individual request that needs it (AC-3).
   */
  async secretOrKeyProvider(
    request: any,
    rawJwtToken: any,
    done: (err: any, secret?: string | Buffer) => void,
  ): Promise<void> {
    try {
      const client = await this.resolveJwksClient();
      client(request, rawJwtToken, done);
    } catch (error) {
      done(error);
    }
  }

  /**
   * Returns the `jwks-rsa` client for the currently-resolved JWKS endpoint,
   * rebuilding it only when the discovery cache hands back a different URI
   * (rotation absorbed without a restart).
   */
  private async resolveJwksClient(): Promise<
    ReturnType<typeof passportJwtSecret>
  > {
    const jwksUri = this.discovery
      ? await this.discovery.getJwksUri()
      : this.fallbackJwksUri;

    if (!this.jwksClient || this.resolvedJwksUri !== jwksUri) {
      this.jwksClient = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      });
      this.resolvedJwksUri = jwksUri;
    }

    return this.jwksClient;
  }

  validate(payload: Record<string, any>): Promise<AuthenticatedUser> {
    const externalId = this.identityResolver.resolveExternalId(payload);

    const user$ = this.httpClient
      .get(`/users/sub/${externalId}`)
      .pipe(map((response) => response.data));

    return firstValueFrom(user$);
  }
}
