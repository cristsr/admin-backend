import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { ScheduledHandler, Status, User } from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  ScheduledFilterImp,
  ScheduledImp,
  ScheduledInputImp,
} from 'app/finances/scheduled/dto';

@Resolver(ScheduledImp)
export class ScheduledResolver {
  constructor(private scheduledHandler: ScheduledHandler) {}

  @Query(() => ScheduledImp, { nullable: true })
  scheduled(@Args('id') id: number): Observable<ScheduledImp> {
    return this.scheduledHandler.findOne({ id });
  }

  // TODO: update name
  @Query(() => [ScheduledImp])
  schedules(
    @Args('filter') filter: ScheduledFilterImp
  ): Observable<ScheduledImp[]> {
    return this.scheduledHandler.findAll(filter);
  }

  @Mutation(() => ScheduledImp)
  saveScheduled(
    @CurrentUser() user: User,
    @Args('scheduled') scheduled: ScheduledInputImp
  ): Observable<ScheduledImp> {
    return this.scheduledHandler.save({
      ...scheduled,
      user: user.id,
    });
  }

  //TODO: update status
  @Mutation(() => Status)
  removeScheduled(@Args('id') id: number): Observable<Status> {
    return this.scheduledHandler.remove({ id });
  }
}
