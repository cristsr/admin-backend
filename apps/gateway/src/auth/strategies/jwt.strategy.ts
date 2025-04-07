import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@core';
import { ObjectLiteral } from '@shared';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, map, tap } from 'rxjs';
import { ENV } from 'app/env';
import { USER_API } from 'app/modules/users/constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  #logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(USER_API) private httpClient: HttpService,
    private config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: config.get(ENV.AUTH0_ISSUER) + '/.well-known/jwks.json',
      }),
      audience: config.get(ENV.AUTH0_AUDIENCE),
      issuer: config.get(ENV.AUTH0_ISSUER) + '/',
      algorithms: ['RS256'],
    });
  }

  validate(payload: ObjectLiteral): Promise<User> {
    const auth0Id = (payload.sub as string).split('|').pop();

    const user$ = this.httpClient.get(`users/sub/${auth0Id}`).pipe(
      map((r) => r.data),
      tap((user) => this.#logger.debug(user)),
    );

    return firstValueFrom(user$);
  }
}
