import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  Id,
  Status,
  USER_HANDLER,
  User,
  UserHandler,
  UserInput,
  UserQuery,
  Users,
} from '@core';
import { Observable } from 'rxjs';
import { UserService } from 'app/user/services';

@Controller()
export class UserController implements UserHandler {
  constructor(private userService: UserService) {}

  @GrpcMethod(USER_HANDLER)
  findAll(): Observable<Users> {
    return this.userService.findAll();
  }

  @GrpcMethod(USER_HANDLER)
  findOne(queryUser: UserQuery): Observable<User> {
    return this.userService.findOne(queryUser);
  }

  @GrpcMethod(USER_HANDLER)
  save(data: UserInput): Observable<User> {
    return this.userService.save(data);
  }

  @GrpcMethod(USER_HANDLER)
  remove({ id }: Id): Observable<Status> {
    return this.userService.remove({ id });
  }
}
