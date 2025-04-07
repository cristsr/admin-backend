import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Status, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable, map } from 'rxjs';
import { FINANCES_API } from 'app/modules/finances/constants';
import {
  ScheduledFilterImp,
  ScheduledImp,
  ScheduledInputImp,
} from 'app/modules/finances/scheduled/dto';

@Resolver(ScheduledImp)
export class ScheduledResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => ScheduledImp, { nullable: true })
  scheduled(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<ScheduledImp> {
    return this.http
      .get<ScheduledImp>(`/scheduled/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  // TODO: update name
  @Query(() => [ScheduledImp])
  schedules(
    @CurrentUser() user: User,
    @Args('filter') filter: ScheduledFilterImp,
  ): Observable<ScheduledImp[]> {
    return this.http
      .get<ScheduledImp[]>(`/scheduled`, {
        params: {
          ...filter,
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Mutation(() => ScheduledImp)
  saveScheduled(
    @CurrentUser() user: User,
    @Args('scheduled') scheduled: ScheduledInputImp,
  ): Observable<ScheduledImp> {
    return this.http
      .post<ScheduledImp>(`/scheduled`, {
        ...scheduled,
        user: user.id,
      })
      .pipe(map((response) => response.data));
  }

  //TODO: update status
  @Mutation(() => Status)
  removeScheduled(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<Status> {
    return this.http
      .delete<Status>(`/scheduled/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }
}
