import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  MOVEMENT_HANDLER,
  MovementHandler,
  Status,
  User,
} from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  MovementFilterImp,
  MovementImp,
  MovementInputImp,
} from 'app/finances/movement/dto';

@Resolver(MovementImp)
export class MovementResolver {
  constructor(
    @Inject(MOVEMENT_HANDLER)
    private movementService: MovementHandler
  ) {}

  @Query(() => MovementImp, { nullable: true })
  movement(@Args('id') id: number): Observable<MovementImp> {
    return this.movementService.findOne({ id });
  }

  @Query(() => [MovementImp])
  movements(
    @Args('filter') filter: MovementFilterImp
  ): Observable<MovementImp[]> {
    return this.movementService.findAll(filter);
  }

  @Mutation(() => MovementImp)
  saveMovement(
    @CurrentUser() user: User,
    @Args('movement') movement: MovementInputImp
  ): Observable<MovementImp> {
    return this.movementService.save({ ...movement, user: user.id });
  }

  // TODO: update status
  @Mutation(() => Status)
  removeMovement(@Args('id') id: number): Observable<Status> {
    return this.movementService.remove({ id });
  }

  // TODO: update status
  @Mutation(() => Status)
  removeAllMovements(): Observable<Status> {
    return this.movementService.removeAll();
  }
}
