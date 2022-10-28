import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  ScheduledInput,
  Scheduled,
  SCHEDULED_SERVICE,
  ScheduledFilter,
  ScheduledGrpc,
  Status,
  User,
} from '@admin-back/grpc';
import { map, Observable } from 'rxjs';
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
  scheduleds(
    @Args('filters') filters: ScheduledFilter
  ): Observable<Scheduled[]> {
    return this.scheduledService.findAll(filters).pipe(map((res) => res.data));
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
