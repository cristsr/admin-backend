import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  CreateSubcategories,
  SUBCATEGORY_SERVICE,
  Status,
  Subcategory,
  SubcategoryGrpc,
  SubcategoryInput,
} from '@admin-back/grpc';

@Resolver()
export class SubcategoryResolver {
  constructor(
    @Inject(SUBCATEGORY_SERVICE)
    private subcategoryService: SubcategoryGrpc
  ) {}

  @Query(() => Subcategory)
  subcategory(@Args('id') id: number): Observable<Subcategory> {
    return this.subcategoryService.findOne({ id });
  }

  @Query(() => [Subcategory])
  subcategories(@Args('category') category: number): Observable<Subcategory[]> {
    return this.subcategoryService.findByCategory({ id: category });
  }

  @Mutation(() => Subcategory)
  saveSubcategory(
    @Args('subcategory')
    subcategory: SubcategoryInput
  ): Observable<Subcategory> {
    return this.subcategoryService.save(subcategory);
  }

  @Mutation(() => Status)
  saveSubcategories(
    @Args('subcategories')
    subcategories: CreateSubcategories
  ): Observable<Status> {
    return this.subcategoryService.saveMany(subcategories);
  }

  @Mutation(() => Status)
  removeSubcategory(@Args('id') id: number): Observable<Status> {
    return this.subcategoryService.remove({ id });
  }
}
