import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategories,
  Subcategory,
  SUBCATEGORY_SERVICE,
  SubcategoryService,
} from '@admin-back/grpc';
import { Observable } from 'rxjs';

@Resolver()
export class SubcategoryResolver {
  @Inject(SUBCATEGORY_SERVICE)
  private subcategoryService: SubcategoryService;

  @Query(() => [Subcategory])
  getSubcategories(
    @Args('subcategories')
    data: CreateSubcategories
  ): Observable<Status> {
    return this.subcategoryService.createMany(data);
  }

  @Mutation(() => Subcategory)
  createSubcategory(
    @Args('subcategory')
    data: CreateSubcategory
  ): Observable<Subcategory> {
    return this.subcategoryService.create(data);
  }

  @Mutation(() => Status)
  createSubcategories(
    @Args('subcategories')
    data: CreateSubcategories
  ): Observable<Status> {
    return this.subcategoryService.createMany(data);
  }
}
