import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable, of } from 'rxjs';
import {
  CreateUser,
  Id,
  Roles,
  Status,
  UpdateUser,
  User,
} from '@admin-back/grpc';
import { UserHandler } from 'app/handlers';

@GrpcService('user')
export class RolService {
  constructor(private userHandler: UserHandler) {}

  @GrpcMethod()
  findAll(): Observable<Roles> {
    return of({ data: [] });
  }

  @GrpcMethod()
  findOne({ id }: Id): Observable<User> {
    return from(this.userHandler.findOne({ id }));
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
