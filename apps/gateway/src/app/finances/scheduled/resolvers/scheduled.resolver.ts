import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  SCHEDULED_HANDLER,
  ScheduledHandler,
  Status,
  User,
} from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  ScheduledFilterImp,
  ScheduledImp,
  ScheduledInputImp,
} from 'app/finances/scheduled/dto';

@Resolver(ScheduledImp)
export class ScheduledResolver {
  constructor(
    @Inject(SCHEDULED_HANDLER)
    private scheduledService: ScheduledHandler
  ) {}

  @Query(() => ScheduledImp, { nullable: true })
  scheduled(@Args('id') id: number): Observable<ScheduledImp> {
    return this.scheduledService.findOne({ id });
  }

  // TODO: update name
  @Query(() => [ScheduledImp])
  schedules(
    @Args('filter') filter: ScheduledFilterImp
  ): Observable<ScheduledImp[]> {
    return this.scheduledService.findAll(filter);
  }

  @Mutation(() => ScheduledImp)
  saveScheduled(
    @CurrentUser() user: User,
    @Args('scheduled') scheduled: ScheduledInputImp
  ): Observable<ScheduledImp> {
    return this.scheduledService.save({
      ...scheduled,
      user: user.id,
    });
  }

  //TODO: update status
  @Mutation(() => Status)
  removeScheduled(@Args('id') id: number): Observable<Status> {
    return this.scheduledService.remove({ id });
  }
}
