import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import {
  CreateUser,
  Id,
  Status,
  UpdateUser,
  User,
  UserGrpc,
  Users,
} from '@admin-back/grpc';
import { UserHandler } from 'app/handlers';

@GrpcService('user')
export class UserService implements UserGrpc {
  constructor(private userHandler: UserHandler) {}

  @GrpcMethod()
  findAll(): Observable<Users> {
    return from(this.userHandler.findAll());
  }

  @GrpcMethod()
  findOne({ id }: Id): Observable<User> {
    return from(this.userHandler.findOne(id));
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
