import {
  CACHE_MANAGER,
  CacheStore,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccessToken, Credential, UserId } from '@admin-back/shared';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { compare, genSalt, hash } from 'bcrypt';
import { ENV } from 'env';
import { RegisterReq, LoginReq, RecoveryReq } from 'auth/dto';
import { UserEntity } from 'auth/entities';

@Injectable()
export class AuthService {
  #logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @Inject(CACHE_MANAGER)
    private cache: CacheStore,

    private jwt: JwtService,
    private config: ConfigService
  ) {}

  async register(data: RegisterReq) {
    if (await this.userRepository.findOneBy({ email: data.email })) {
      throw new UnprocessableEntityException('Email already exists');
    }

    data.password = await hash(
      data.password,
      await genSalt(this.config.get(ENV.HASH_ROUNDS))
    );

    return this.userRepository.save(data);
  }

  async login(data: LoginReq) {
    const user = await this.userRepository.findOneBy({ email: data.email });

    if (!user) {
      const message = 'User not found';
      this.#logger.error(`${message}: ${data.email}`);
      throw new NotFoundException(message);
    }

    const isValid = await compare(data.password, user.password);

    if (!isValid) {
      const message = 'Invalid password';
      this.#logger.error(`${message} for ${user.email}`);
      throw new ForbiddenException(message);
    }

    delete user.password;

    const accessToken = this.genAccessToken(user);
    const refreshToken = this.genRefreshToken(user);

    return {
      user,
      credentials: {
        accessToken,
        refreshToken,
      },
    };
  }

  async logout(id: UserId) {
    this.cache.del(id + '_access_token');
    return true;
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

    const user: UserEntity = await this.cache.get(
      decodedToken.iss + '_access_token'
    );

    this.#logger.debug('Get user from cache');
    console.debug(user);

    if (!user) {
      const message = 'Token is expired';
      this.#logger.error(`${message}: ${decodedToken.iss}`);
      throw new UnauthorizedException(message);
    }

    return user;
  }

  private genAccessToken(user: UserEntity): Credential {
    const jwtExpiration = this.config.get(ENV.JWT_EXPIRATION);

    const expires = DateTime.utc()
      .plus({ minutes: jwtExpiration })
      .toUnixInteger();

    const payload = {
      iss: user.id,
      exp: expires,
      issuer: 'url.com',
    };

    const value = this.jwt.sign(payload, {
      secret: this.config.get(ENV.JWT_SECRET),
    });

    this.cache.set(user.id + '_access_token', user, {
      ttl: jwtExpiration * 60,
    });

    return {
      value,
      expires,
    };
  }

  private genRefreshToken(user: UserEntity): Credential {
    const expires = DateTime.utc()
      .plus({ minutes: this.config.get(ENV.JWT_REFRESH_EXPIRATION) })
      .toUnixInteger();

    const payload = {
      iss: user.id,
      exp: expires,
      issuer: 'url.com',
    };

    const value = this.jwt.sign(payload, {
      secret: this.config.get(ENV.JWT_REFRESH_SECRET),
    });

    return {
      value,
      expires,
    };
  }
}
