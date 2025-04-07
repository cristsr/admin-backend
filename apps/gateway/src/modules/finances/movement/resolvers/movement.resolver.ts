import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Status, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable, map } from 'rxjs';
import { FINANCES_API } from 'app/modules/finances/constants';
import {
  MovementFilterImp,
  MovementImp,
  MovementInputImp,
} from 'app/modules/finances/movement/dto';

@Resolver(MovementImp)
export class MovementResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => MovementImp, { nullable: true })
  movement(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<MovementImp> {
    return this.http
      .get<MovementImp>(`/movements/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [MovementImp])
  movements(
    @CurrentUser() user: User,
    @Args('filter') filter: MovementFilterImp,
  ): Observable<MovementImp[]> {
    return this.http
      .get<MovementImp[]>(`/movements`, {
        params: {
          ...filter,
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Mutation(() => MovementImp)
  saveMovement(
    @CurrentUser() user: User,
    @Args('movement') movement: MovementInputImp,
  ): Observable<MovementImp> {
    return this.http
      .post<MovementImp>(`/movements`, {
        ...movement,
        user: user.id,
      })
      .pipe(map((response) => response.data));
  }

  @Mutation(() => Status)
  removeMovement(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<Status> {
    return this.http
      .delete<Status>(`/movements/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }
}
