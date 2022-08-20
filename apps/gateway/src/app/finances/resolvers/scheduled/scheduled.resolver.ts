import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  CreateScheduled,
  Scheduled,
  SCHEDULED_SERVICE,
  ScheduledGrpc,
  Status,
  UpdateScheduled,
} from '@admin-back/grpc';
import { Observable, pluck } from 'rxjs';

@Resolver()
export class ScheduledResolver {
  @Inject(SCHEDULED_SERVICE)
  private scheduledService: ScheduledGrpc;

  @Query(() => Scheduled)
  getScheduled(@Args('id') id: number): Observable<Scheduled> {
    return this.scheduledService.findOne({ id });
  }

  @Query(() => [Scheduled])
  getScheduleds(): Observable<Scheduled[]> {
    return this.scheduledService.findAll({}).pipe(pluck('data'));
  }

  @Mutation(() => Scheduled)
  createScheduled(
    @Args('scheduled') scheduled: CreateScheduled
  ): Observable<Scheduled> {
    return this.scheduledService.create(scheduled);
  }

  @Mutation(() => Scheduled)
  updateScheduled(
    @Args('scheduled') scheduled: UpdateScheduled
  ): Observable<Scheduled> {
    return this.scheduledService.update(scheduled);
  }

  @Mutation(() => Status)
  removeScheduled(@Args('id') id: number): Observable<Status> {
    return this.scheduledService.remove({ id });
  }
}
