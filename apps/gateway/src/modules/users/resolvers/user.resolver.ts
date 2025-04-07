import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '@core';
import { CurrentUser, Public } from '@shared';
import { Observable, map } from 'rxjs';
import { USER_API } from 'app/modules/users/constants';
import { UserImp, UserInputImp } from 'app/modules/users/dto';

@Resolver(() => UserImp)
export class UserResolver {
  constructor(
    @Inject(USER_API)
    private httpClient: HttpService,
  ) {}

  @Query(() => [UserImp])
  users(): Observable<UserImp[]> {
    return this.httpClient
      .get<{ data: UserImp[] }>('/users')
      .pipe(map((res) => res.data.data));
  }

  @Query(() => UserImp)
  user(@CurrentUser() user: User) {
    return user;
  }

  @Public()
  @Mutation(() => UserImp)
  saveUser(@Args('user') user: UserInputImp) {
    return this.httpClient
      .post<UserImp>('/users', user)
      .pipe(map((res) => res.data));
  }

  @Mutation(() => UserImp)
  removeUser(@Args('id') id: number) {
    return this.httpClient
      .delete<UserImp>(`/users/${id}`)
      .pipe(map((res) => res.data));
  }
}
