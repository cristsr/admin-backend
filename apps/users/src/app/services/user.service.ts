import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, map, Observable, switchMap, tap } from 'rxjs';
import {
  UserInput,
  Id,
  UserQuery,
  Status,
  User,
  UserGrpc,
  Users,
} from '@admin-back/grpc';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'app/entities';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

@GrpcService('user')
export class UserService implements UserGrpc {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>
  ) {}

  @GrpcMethod()
  findAll(): Observable<Users> {
    return defer(() => this.userRepository.find()).pipe(
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  findOne(queryUser: UserQuery): Observable<User> {
    return defer(() => this.userRepository.findOneBy(queryUser));
  }

  @GrpcMethod()
  save(data: UserInput): Observable<User> {
    const user = defer(() =>
      this.userRepository.findOne({
        where: {
          email: data.email,
          auth0Id: data.auth0Id,
        },
      })
    );

    return user.pipe(
      tap((u) => {
        if (u) {
          throw new NotFoundException('User is already registered');
        }
      }),
      switchMap(() => this.userRepository.save(data))
    );
  }

  @GrpcMethod()
  remove({ id }: Id): Observable<Status> {
    return defer(() => this.userRepository.delete({ id })).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }
}
