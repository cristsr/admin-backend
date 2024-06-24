import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User, UserHandler } from '@core';
import { CurrentUser, Public } from '@shared';
import { Observable, map } from 'rxjs';
import { UserImp, UserInputImp } from 'app/users/dto';

@Resolver(() => UserImp)
export class UserResolver {
  constructor(private userHandler: UserHandler) {}

  @Query(() => [UserImp])
  users(): Observable<UserImp[]> {
    return this.userHandler.findAll().pipe(map((res) => res.data));
  }

  @Query(() => UserImp)
  user(@CurrentUser() user: User) {
    return user;
  }

  @Public()
  @Mutation(() => UserImp)
  saveUser(@Args('user') user: UserInputImp) {
    return this.userHandler.save(user);
  }

  @Mutation(() => UserImp)
  removeUser(@Args('id') id: number) {
    return this.userHandler.remove({ id });
  }
}
