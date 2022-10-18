import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  Category,
  CATEGORY_SERVICE,
  CategoryGrpc,
  CreateScheduled,
  Scheduled,
  SCHEDULED_SERVICE,
  ScheduledFilter,
  ScheduledGrpc,
  Status,
  Subcategory,
  SUBCATEGORY_SERVICE,
  SubcategoryGrpc,
  UpdateScheduled,
  User,
} from '@admin-back/grpc';
import { map, Observable } from 'rxjs';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Scheduled)
export class ScheduledResolver {
  constructor(
    @Inject(SCHEDULED_SERVICE)
    private scheduledService: ScheduledGrpc,

    @Inject(CATEGORY_SERVICE)
    private categoryService: CategoryGrpc,

    @Inject(SUBCATEGORY_SERVICE)
    private subcategoryService: SubcategoryGrpc
  ) {}

  @Query(() => Scheduled, { nullable: true })
  getScheduled(@Args('id') id: number): Observable<Scheduled> {
    return this.scheduledService.findOne({ id });
  }

  @Query(() => [Scheduled])
  getScheduleds(
    @Args('filters') filters: ScheduledFilter
  ): Observable<Scheduled[]> {
    return this.scheduledService.findAll(filters).pipe(map((res) => res.data));
  }

  @Mutation(() => Scheduled)
  createScheduled(
    @CurrentUser() user: User,
    @Args('scheduled') scheduled: CreateScheduled
  ): Observable<Scheduled> {
    return this.scheduledService.create({
      ...scheduled,
      user: user.id,
    });
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

  @ResolveField(() => Category)
  category(@Parent() scheduled: Scheduled): Observable<Category> | Category {
    console.log('resolve category', scheduled);
    if (scheduled.category) return scheduled.category;
    return this.categoryService.findOne({ id: scheduled.categoryId });
  }

  @ResolveField(() => Subcategory)
  subcategory(
    @Parent() scheduled: Scheduled
  ): Observable<Subcategory> | Subcategory {
    if (scheduled.subcategory) return scheduled.subcategory;
    return this.subcategoryService.findOne({ id: scheduled.subcategoryId });
  }
}
