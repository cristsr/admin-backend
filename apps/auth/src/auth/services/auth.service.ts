import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RegisterReq, LoginReq, RecoveryReq } from 'auth/dto';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from '@admin-back/shared';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { ENV } from 'env';
import { UserEntity } from 'auth/entities';
import { AUTH_STRATEGIES } from 'auth/types';
import { AuthStrategies, AuthStrategy } from 'auth/strategies';

@Injectable()
export class AuthService {
  #logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_STRATEGIES)
    private strategies: AuthStrategy[],

    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    private jwt: JwtService,

    private config: ConfigService
  ) {}

  async register(data: RegisterReq) {
    const strategy = this.strategies.find(
      (object: AuthStrategy) => object instanceof AuthStrategies[data.type]
    );

    return strategy.register(data);
  }

  async login(data: LoginReq) {
    const strategy = this.strategies.find(
      (object: AuthStrategy) => object instanceof AuthStrategies[data.type]
    );

    const user: UserEntity = await strategy.login(data);

    const jwtSecret = this.config.get(ENV.JWT_SECRET);
    const jwtExpiration = this.config.get(ENV.JWT_EXPIRATION);

    const jwtRefreshSecret = this.config.get(ENV.JWT_REFRESH_SECRET);
    const jwtRefreshExpiration = this.config.get(ENV.JWT_REFRESH_EXPIRATION);

    const payload = {
      iss: user.id,
      exp: DateTime.utc()
        .plus({
          minutes: jwtExpiration,
        })
        .toUnixInteger(),
      issuer: 'url.com',
    };

    const refreshPayload = {
      iss: user.id,
      exp: jwtRefreshExpiration,
      issuer: 'url.com',
    };

    const token = this.jwt.sign(payload, {
      secret: jwtSecret,
    });

    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: jwtRefreshSecret,
    });

    return {
      user,
      credentials: {
        accessToken: {
          value: token,
          expires: jwtExpiration,
        },
        refreshToken: {
          value: refreshToken,
          expires: jwtRefreshExpiration,
        },
      },
    };
  }

  recovery(data: RecoveryReq) {
    return `This action returns a #${data.email} auth`;
  }

  async getUserFromToken(data: AccessToken): Promise<UserEntity> {
    const token = data.token.split(' ')[1];

    const decodedToken = await this.jwt
      .verifyAsync(token, {
        secret: this.config.get(ENV.JWT_SECRET),
      })
      .catch((err) => {
        this.#logger.error(err.message);
        throw new InternalServerErrorException(err.message);
      });

    return this.userRepository.findOne({
      where: { id: decodedToken.iss },
    });
  }
}
