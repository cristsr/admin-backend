import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import {
  CreateUser,
  Id,
  QueryUser,
  Status,
  UpdateUser,
  User,
  UserGrpc,
  Users,
} from '@admin-back/grpc';
import { UserHandler } from 'app/handlers';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'app/entities';
import { Repository } from 'typeorm';

@GrpcService('user')
export class UserService implements UserGrpc {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    private userHandler: UserHandler
  ) {}

  @GrpcMethod()
  findAll(): Observable<Users> {
    return from(this.userHandler.findAll());
  }

  @GrpcMethod()
  findOne(queryUser: QueryUser): Observable<User> {
    console.log(queryUser);
    return from(this.userHandler.findOne(queryUser));
  }

  @GrpcMethod()
  create(user: CreateUser): Observable<User> {
    return from(this.userHandler.create(user));
  }

  @GrpcMethod()
  update(user: UpdateUser): Observable<User> {
    return from(this.userHandler.update(user));
  }

  @GrpcMethod()
  remove({ id }: Id): Observable<Status> {
    return from(this.userHandler.remove(id));
  }
}
