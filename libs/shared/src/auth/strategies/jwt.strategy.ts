import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_STRATEGY_OPTIONS } from '../constants/auth.constants';
import { AuthenticatedUserProvider } from '../providers/authenticated-user.provider';
import { IdentityResolver } from '../resolvers/identity-resolver';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtStrategyOptions } from '../types/jwt-strategy-options.type';

/**
 * Verifies RS256 access tokens against the IdP's JWKS (via jwks-rsa, the
 * standard passport bridge) and resolves the local user through the injected
 * {@link AuthenticatedUserProvider}. The JWKS URI is discovered at bootstrap, so
 * the strategy only needs a static endpoint here.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_STRATEGY_OPTIONS) options: JwtStrategyOptions,
    private readonly identityResolver: IdentityResolver,
    private readonly userProvider: AuthenticatedUserProvider,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: options.jwksUri,
      }),
      audience: options.audience,
      issuer: options.issuer,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, any>): Promise<AuthenticatedUser> {
    const externalId = this.identityResolver.resolveExternalId(payload);

    return this.userProvider.findByExternalId(externalId);
  }
}
