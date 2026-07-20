import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, map } from 'rxjs';
import { Nullable } from '../types/nullable.type';
import {
  JWT_STRATEGY_OPTIONS,
  OIDC_DISCOVERY_CACHE,
  USERS_SERVICE_CLIENT,
} from './auth.constants';
import { AuthenticatedUser } from './authenticated-user.type';
import { IdentityResolver } from './identity-resolver';
import { JwtStrategyOptions } from './jwt-strategy-options.type';
import { OidcDiscoveryCache } from './oidc-discovery-cache';

/**
 * Lazily resolves the JWKS endpoint through the discovery cache, so app
 * bootstrap never hits the IdP and a URI rotation rebuilds the client.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private jwksClient: Nullable<ReturnType<typeof passportJwtSecret>> = null;
  private resolvedJwksUri: Nullable<string> = null;
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

    // Inline discovery (used by unit tests) wins over the DI-injected cache.
    this.discovery = options.discovery ?? injectedDiscovery;
    this.fallbackJwksUri = options.jwksUri ?? '';
  }

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

  /** Rebuilds the client only when the resolved JWKS URI changes. */
  private async resolveJwksClient(): Promise<
    ReturnType<typeof passportJwtSecret>
  > {
    const jwksUri = await this.resolveJwksUri();

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

  /** Prefers lazy discovery; falls back to the statically configured URI. */
  private resolveJwksUri(): Promise<string> {
    if (!this.discovery) return Promise.resolve(this.fallbackJwksUri);

    return this.discovery.getJwksUri();
  }

  validate(payload: Record<string, any>): Promise<AuthenticatedUser> {
    const externalId = this.identityResolver.resolveExternalId(payload);

    const user$ = this.httpClient
      .get(`/users/sub/${externalId}`)
      .pipe(map((response) => response.data));

    return firstValueFrom(user$);
  }
}
