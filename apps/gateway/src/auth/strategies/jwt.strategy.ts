import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User, UserHandler } from '@core';
import { ObjectLiteral } from '@shared';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, tap } from 'rxjs';
import { ENV } from 'app/config/env';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  #logger = new Logger(JwtStrategy.name);

  constructor(private userService: UserHandler, private config: ConfigService) {
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
    //
    const auth0Id = (payload.sub as string).split('|').pop();

    const user$ = this.userService
      .findOne({ auth0Id })
      .pipe(tap((user) => this.#logger.debug(user)));

    return firstValueFrom(user$);
  }
}
