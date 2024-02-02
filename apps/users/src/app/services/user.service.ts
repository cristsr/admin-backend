import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, defer, map, switchMap, tap } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Id,
  Status,
  User,
  UserGrpc,
  UserInput,
  UserQuery,
  Users,
} from '@admin-back/grpc';
import { UserEntity } from 'app/entities';

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
