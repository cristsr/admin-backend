import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  SCHEDULED_SERVICE,
  Scheduled,
  ScheduledFilter,
  ScheduledGrpc,
  ScheduledInput,
  Status,
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Scheduled)
export class ScheduledResolver {
  constructor(
    @Inject(SCHEDULED_SERVICE)
    private scheduledService: ScheduledGrpc
  ) {}

  @Query(() => Scheduled, { nullable: true })
  scheduled(@Args('id') id: number): Observable<Scheduled> {
    return this.scheduledService.findOne({ id });
  }

  @Query(() => [Scheduled])
  scheduleds(@Args('filter') filter: ScheduledFilter): Observable<Scheduled[]> {
    return this.scheduledService.findAll(filter);
  }

  @Mutation(() => Scheduled)
  saveScheduled(
    @CurrentUser() user: User,
    @Args('scheduled') scheduled: ScheduledInput
  ): Observable<Scheduled> {
    return this.scheduledService.save({
      ...scheduled,
      user: user.id,
    });
  }

  @Mutation(() => Status)
  removeScheduled(@Args('id') id: number): Observable<Status> {
    return this.scheduledService.remove({ id });
  }
}
