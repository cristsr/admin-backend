import {
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcrypt';
import { ENV } from 'env';
import { AuthStrategy } from 'auth/strategies';
import { LoginReq, RegisterReq } from 'auth/dto';
import { UserEntity } from 'auth/entities';
import { RpcException } from '@nestjs/microservices';
import { serialize } from 'class-transformer';

@Injectable()
export class LocalService implements AuthStrategy {
  #logger = new Logger(LocalService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    private config: ConfigService
  ) {}

  async register(data: RegisterReq): Promise<any> {
    const rounds = this.config.get(ENV.HASH_ROUNDS);

    data.password = await hash(data.password, rounds);

    return this.userRepository.save(data).catch((e) => {
      const message = 'User already exists';
      this.#logger.error(`${e.name}: ${e.message}`);
      throw new UnprocessableEntityException(message);
    });
  }

  async login(data: LoginReq): Promise<UserEntity> {
    const user = await this.userRepository
      .findOneOrFail({
        where: {
          email: data.email,
        },
      })
      .catch((e) => {
        const message = 'User not found';
        this.#logger.error(`${e.name}: ${e.message}`);
        throw new NotFoundException(message);
      });

    const isValid = await compare(data.password, user.password);

    if (!isValid) {
      const message = 'Invalid password';
      this.#logger.error(`${message} for ${user.email}`);

      // const error = new RpcException({
      //   // code: HttpStatus.FORBIDDEN,
      //   code: 1,
      //   message: {
      //     status: HttpStatus.FORBIDDEN,
      //     message,
      //   },
      // });
      throw new ForbiddenException(message);
      // throw error;
    }

    return user;
  }
}
