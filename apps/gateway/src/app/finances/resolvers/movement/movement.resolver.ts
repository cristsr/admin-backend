import { Headers, Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import {
  MovementInput,
  Movement,
  MOVEMENT_SERVICE,
  MovementFilter,
  MovementGrpc,
  Status,
  User,
} from '@admin-back/grpc';
import { ClientTimeZone, CurrentUser } from '@admin-back/shared';
import { DateTime } from 'luxon';
import { Metadata } from '@grpc/grpc-js';

@Resolver(Movement)
export class MovementResolver {
  constructor(
    @Inject(MOVEMENT_SERVICE)
    private movementService: MovementGrpc
  ) {}

  @Query(() => Movement, { nullable: true })
  movement(@Args('id') id: number): Observable<Movement> {
    return this.movementService.findOne({ id });
  }

  @Query(() => [Movement])
  movements(
    @Args('filter') filter: MovementFilter,
    @ClientTimeZone() clientTimeZone: string
  ): Observable<Movement[]> {
    const metadata = new Metadata();
    metadata.set('client-time-zone', clientTimeZone);
    return this.movementService.findAll(filter, metadata);
  }

  @Mutation(() => Movement)
  saveMovement(
    @CurrentUser() user: User,
    @Args('movement') movement: MovementInput
  ): Observable<Movement> {
    return this.movementService
      .save({ ...movement, user: user.id })
      .pipe(tap((m) => console.log(m)));
  }

  @Mutation(() => Status)
  removeMovement(@Args('id') id: number): Observable<Status> {
    return this.movementService.remove({ id });
  }

  @Mutation(() => Status)
  removeAllMovements(): Observable<Status> {
    return this.movementService.removeAll();
  }
}
