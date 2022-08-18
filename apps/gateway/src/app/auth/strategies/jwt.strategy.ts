import { Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { expressJwtSecret } from 'jwks-rsa';
import { ENV } from 'env';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken,
      secretOrKey: expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: config.get(ENV.AUTH0_ISSUER) + '/.well-known/jwks.json',
        handleSigningKeyError: (err, cb) => {
          console.log(err.message, err.stack);
          cb(err);
        },
      }),
      // audience: config.get(ENV.AUTH0_AUDIENCE),
      algorithms: ['RS256'],
    });
  }

  async validate(payload) {
    console.log(payload);
    return {
      userId: payload.sub,
      username: payload.username,
    };
  }
}
