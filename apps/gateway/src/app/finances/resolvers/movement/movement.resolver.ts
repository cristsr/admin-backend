import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  CreateMovement,
  Movement,
  MOVEMENT_SERVICE,
  MovementFilter,
  MovementGrpc,
  Status,
  UpdateMovement,
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver()
export class MovementResolver {
  @Inject(MOVEMENT_SERVICE)
  private movementService: MovementGrpc;

  @Query(() => Movement)
  getMovement(@Args('id') id: number): Observable<Movement> {
    return this.movementService.findOne({ id });
  }

  @Query(() => [Movement])
  getMovements(
    @Args('filters') filters: MovementFilter
  ): Observable<Movement[]> {
    return this.movementService.findAll(filters).pipe(map((res) => res.data));
  }

  @Mutation(() => Movement)
  createMovement(
    @CurrentUser() user: User,
    @Args('movement') movement: CreateMovement
  ): Observable<Movement> {
    return this.movementService.create({
      ...movement,
      user: user.id,
    });
  }

  @Mutation(() => Movement)
  updateMovement(
    @Args('movement') movement: UpdateMovement
  ): Observable<Movement> {
    return this.movementService.update(movement);
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
