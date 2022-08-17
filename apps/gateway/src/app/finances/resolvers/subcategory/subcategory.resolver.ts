import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategory,
  SUBCATEGORY_SERVICE,
  SubcategoryGrpc,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { Observable, pluck } from 'rxjs';

@Resolver()
export class SubcategoryResolver {
  @Inject(SUBCATEGORY_SERVICE)
  private subcategoryService: SubcategoryGrpc;

  @Query(() => Subcategory)
  getSubcategory(@Args('id') id: number): Observable<Subcategory> {
    return this.subcategoryService.findOne({ id });
  }

  @Query(() => [Subcategory])
  getSubcategories(
    @Args('category') category: number
  ): Observable<Subcategory[]> {
    return this.subcategoryService
      .findByCategory({ id: category })
      .pipe(pluck('data'));
  }

  @Mutation(() => Subcategory)
  createSubcategory(
    @Args('subcategory')
    subcategory: CreateSubcategory
  ): Observable<Subcategory> {
    return this.subcategoryService.create(subcategory);
  }

  @Mutation(() => Status)
  createSubcategories(
    @Args('subcategories')
    subcategories: CreateSubcategories
  ): Observable<Status> {
    return this.subcategoryService.createMany(subcategories);
  }

  @Mutation(() => Subcategory)
  updateSubcategory(
    @Args('subcategory') subcategory: UpdateSubcategory
  ): Observable<Subcategory> {
    return this.subcategoryService.update(subcategory);
  }

  @Mutation(() => Status)
  removeSubcategory(@Args('id') id: number): Observable<Status> {
    return this.subcategoryService.remove({ id });
  }
}
