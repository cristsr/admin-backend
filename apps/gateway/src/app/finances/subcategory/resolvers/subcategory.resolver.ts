import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  SUBCATEGORY_HANDLER,
  Status,
  SubcategoryHandler,
} from '@admin-back/core';
import {
  CreateSubcategoriesImp,
  SubcategoryImp,
  SubcategoryInputImp,
} from 'app/finances/subcategory/dto';

@Resolver(SubcategoryImp)
export class SubcategoryResolver {
  constructor(
    @Inject(SUBCATEGORY_HANDLER)
    private subcategoryService: SubcategoryHandler
  ) {}

  @Query(() => SubcategoryImp)
  subcategory(@Args('id') id: number): Observable<SubcategoryImp> {
    return this.subcategoryService.findOne({ id });
  }

  @Query(() => [SubcategoryImp])
  subcategories(
    @Args('category') category: number
  ): Observable<SubcategoryImp[]> {
    return this.subcategoryService.findByCategory({ id: category });
  }

  @Mutation(() => SubcategoryImp)
  saveSubcategory(
    @Args('subcategory')
    subcategory: SubcategoryInputImp
  ): Observable<SubcategoryImp> {
    return this.subcategoryService.save(subcategory);
  }

  @Mutation(() => Status)
  saveSubcategories(
    @Args('subcategories')
    subcategories: CreateSubcategoriesImp
  ): Observable<Status> {
    return this.subcategoryService.saveMany(subcategories);
  }

  //TODO: update status
  @Mutation(() => Status)
  removeSubcategory(@Args('id') id: number): Observable<Status> {
    return this.subcategoryService.remove({ id });
  }
}
