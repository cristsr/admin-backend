import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  Category,
  CATEGORY_SERVICE,
  CategoryGrpc,
  CreateMovement,
  Movement,
  MOVEMENT_SERVICE,
  MovementFilter,
  MovementGrpc,
  Status,
  Subcategory,
  SUBCATEGORY_SERVICE,
  SubcategoryGrpc,
  UpdateMovement,
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Movement)
export class MovementResolver {
  constructor(
    @Inject(MOVEMENT_SERVICE)
    private movementService: MovementGrpc,

    @Inject(CATEGORY_SERVICE)
    private categoryService: CategoryGrpc,

    @Inject(SUBCATEGORY_SERVICE)
    private subcategoryService: SubcategoryGrpc
  ) {}

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

  @ResolveField()
  category(@Parent() movement: Movement): Observable<Category> | Category {
    if (movement.category) return movement.category;
    return this.categoryService.findOne({ id: movement.categoryId });
  }

  @ResolveField()
  subcategory(
    @Parent() movement: Movement
  ): Observable<Subcategory> | Subcategory {
    if (movement.subcategory) return movement.subcategory;
    return this.subcategoryService.findOne({ id: movement.subcategoryId });
  }
}
