import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUser, Status, UpdateUser, User, Users } from '@admin-back/grpc';
import { Repository } from 'typeorm';
import { UserEntity } from 'app/entities';

@Injectable()
export class UserHandler {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>
  ) {}

  findAll(): Promise<Users> {
    return this.userRepository.find().then((data) => ({ data }));
  }

  findOne(id: number): Promise<User> {
    return this.userRepository.findOneBy({ id });
  }

  create(user: CreateUser): Promise<User> {
    return this.userRepository.save(user);
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
