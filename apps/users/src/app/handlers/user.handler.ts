import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateUser,
  QueryUser,
  Status,
  UpdateUser,
  User,
  Users,
} from '@admin-back/grpc';
import { Repository } from 'typeorm';
import { UserEntity } from 'app/entities';
import { GrpcAlreadyExistException } from '@admin-back/shared';

@Injectable()
export class UserHandler {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>
  ) {}

  findAll(): Promise<Users> {
    return this.userRepository.find().then((data) => ({ data }));
  }

  findOne(queryUser: QueryUser): Promise<User> {
    return this.userRepository.findOneBy(queryUser);
  }

  async create(data: CreateUser): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        email: data.email,
        auth0Id: data.auth0Id,
      },
    });

    if (user) {
      throw new GrpcAlreadyExistException('');
    }

    return this.userRepository.save(data);
  }

  update(user: UpdateUser): Promise<User> {
    return this.userRepository
      .save(user)
      .then(() => this.userRepository.findOneBy({ id: user.id }));
  }

  remove(id: number): Promise<Status> {
    return this.userRepository.delete({ id }).then((result) => {
      if (result.affected) {
        return { status: true };
      }

      return { status: false };
    });
  }
}
