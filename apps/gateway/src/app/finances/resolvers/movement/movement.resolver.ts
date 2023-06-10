import { Inject } from '@nestjs/common';
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
import { CurrentUser } from '@admin-back/shared';

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
  movements(@Args('filter') filter: MovementFilter): Observable<Movement[]> {
    return this.movementService.findAll(filter);
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
