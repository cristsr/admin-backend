import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { MovementHandler, Status, User } from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  MovementFilterImp,
  MovementImp,
  MovementInputImp,
} from 'app/finances/movement/dto';

@Resolver(MovementImp)
export class MovementResolver {
  constructor(private movementHandler: MovementHandler) {}

  @Query(() => MovementImp, { nullable: true })
  movement(@Args('id') id: number): Observable<MovementImp> {
    return this.movementHandler.findOne({ id });
  }

  @Query(() => [MovementImp])
  movements(
    @Args('filter') filter: MovementFilterImp
  ): Observable<MovementImp[]> {
    return this.movementHandler.findAll(filter);
  }

  @Mutation(() => MovementImp)
  saveMovement(
    @CurrentUser() user: User,
    @Args('movement') movement: MovementInputImp
  ): Observable<MovementImp> {
    return this.movementHandler.save({ ...movement, user: user.id });
  }

  // TODO: update status
  @Mutation(() => Status)
  removeMovement(@Args('id') id: number): Observable<Status> {
    return this.movementHandler.remove({ id });
  }

  // TODO: update status
  @Mutation(() => Status)
  removeAllMovements(): Observable<Status> {
    return this.movementHandler.removeAll();
  }
}
