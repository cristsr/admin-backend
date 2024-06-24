import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { Status, SubcategoryHandler } from '@admin-back/core';
import {
  SubcategoriesInputImp,
  SubcategoryImp,
  SubcategoryInputImp,
} from 'app/finances/subcategory/dto';

@Resolver(SubcategoryImp)
export class SubcategoryResolver {
  constructor(private subcategoryHandler: SubcategoryHandler) {}

  @Query(() => SubcategoryImp)
  subcategory(@Args('id') id: number): Observable<SubcategoryImp> {
    return this.subcategoryHandler.findOne({ id });
  }

  @Query(() => [SubcategoryImp])
  subcategories(
    @Args('category') category: number
  ): Observable<SubcategoryImp[]> {
    return this.subcategoryHandler.findByCategory({ id: category });
  }

  @Mutation(() => SubcategoryImp)
  saveSubcategory(
    @Args('subcategory')
    subcategory: SubcategoryInputImp
  ): Observable<SubcategoryImp> {
    return this.subcategoryHandler.save(subcategory);
  }

  @Mutation(() => Status)
  saveSubcategories(
    @Args('subcategories')
    subcategories: SubcategoriesInputImp
  ): Observable<Status> {
    return this.subcategoryHandler.saveMany(subcategories);
  }

  //TODO: update status
  @Mutation(() => Status)
  removeSubcategory(@Args('id') id: number): Observable<Status> {
    return this.subcategoryHandler.remove({ id });
  }
}
