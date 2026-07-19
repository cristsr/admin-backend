import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Id,
  Status,
  User,
  UserHandler,
  UserInput,
  UserQuery,
  Users,
} from '@core';
import { Observable, defer, map, switchMap, tap } from 'rxjs';
import { UserRepository } from 'app/user/repositories';

@Injectable()
export class UserService implements UserHandler {
  constructor(private userRepository: UserRepository) {}

  findAll(): Observable<Users> {
    return defer(() => this.userRepository.find()).pipe(
      map((data) => ({ data }))
    );
  }

  findOne(queryUser: UserQuery): Observable<User> {
    return defer(() => this.userRepository.findOneBy(queryUser));
  }

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

  remove({ id }: Id): Observable<Status> {
    return defer(() => this.userRepository.delete({ id })).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }
}
