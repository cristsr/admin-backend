import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Observable, pluck } from 'rxjs';
import { UserInput, User, USER_SERVICE, UserGrpc } from '@admin-back/grpc';
import { CurrentUser, Public } from '@admin-back/shared';

@Resolver(() => User)
export class UserResolver {
  @Inject(USER_SERVICE)
  private userService: UserGrpc;

  @Query(() => [User])
  users(): Observable<User[]> {
    return this.userService.findAll().pipe(pluck('data'));
  }

  @Query(() => User)
  user(@CurrentUser() user: User) {
    return user;
  }

  @Public()
  @Mutation(() => User)
  saveUser(@Args('user') user: UserInput) {
    return this.userService.save(user);
  }

  @Mutation(() => User)
  removeUser(@Args('id', { type: () => Int }) id: number) {
    return this.userService.remove({ id });
  }
}
