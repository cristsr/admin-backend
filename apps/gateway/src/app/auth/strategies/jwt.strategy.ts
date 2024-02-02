import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ENV } from 'env';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom, tap } from 'rxjs';
import { USER_SERVICE, User, UserGrpc } from '@admin-back/grpc';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  #logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(USER_SERVICE) private userService: UserGrpc,
    private config: ConfigService
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

  validate(payload): Promise<User> {
    this.#logger.debug(payload);

    const auth0Id = (payload.sub as string).split('|').pop();

    const user$ = this.userService
      .findOne({ auth0Id })
      .pipe(tap((user) => this.#logger.debug(user)));

    return firstValueFrom(user$);
  }
}
