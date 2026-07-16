import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, map } from 'rxjs';
import { JWT_STRATEGY_OPTIONS, USERS_SERVICE_CLIENT } from './auth.constants';
import { AuthenticatedUser } from './authenticated-user.type';
import { IdentityResolver } from './identity-resolver';

export interface JwtStrategyOptions {
  issuer: string;
  audience: string;
  jwksUri: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(USERS_SERVICE_CLIENT) private readonly httpClient: HttpService,
    @Inject(JWT_STRATEGY_OPTIONS) options: JwtStrategyOptions,
    private readonly identityResolver: IdentityResolver,
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

    const user$ = this.httpClient
      .get(`/users/sub/${externalId}`)
      .pipe(map((response) => response.data));

    return firstValueFrom(user$);
  }
}
