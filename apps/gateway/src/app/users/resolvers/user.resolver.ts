import { Inject } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable, map } from 'rxjs';
import { USER_SERVICE, User, UserGrpc, UserInput } from '@admin-back/grpc';
import { CurrentUser, Public } from '@admin-back/shared';

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
