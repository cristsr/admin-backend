import { Inject } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { USER_SERVICE, User, UserGrpc, UserInput } from '@core';
import { CurrentUser, Public } from '@shared';
import { Observable, map } from 'rxjs';

@Resolver(() => User)
export class UserResolver {
  @Inject(USER_SERVICE)
  private userService: UserGrpc;

  @Query(() => [User])
  users(): Observable<User[]> {
    return this.userService.findAll().pipe(map((res) => res.data));
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
