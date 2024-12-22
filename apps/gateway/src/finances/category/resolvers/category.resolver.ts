import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CategoryHandler, Status } from '@core';
import { Observable } from 'rxjs';
import {
  CategoriesInputImp,
  CategoryImp,
  CategoryInputImp,
} from 'app/finances/category/dto/category.dto';

@Resolver(CategoryImp)
export class CategoryResolver {
  constructor(private categoryHandler: CategoryHandler) {}

  @Query(() => CategoryImp)
  category(user, @Args('id') id: number) {
    return this.categoryHandler.findOne({ id: +id });
  }

  @Query(() => [CategoryImp])
  categories(): Observable<CategoryImp[]> {
    return this.categoryHandler.findAll();
  }

  @Mutation(() => CategoryImp)
  saveCategory(
    @Args('category')
    category: CategoryInputImp,
  ): Observable<CategoryImp> {
    return this.categoryHandler.save(category);
  }

  @Mutation(() => Status)
  saveCategories(
    @Args('categories')
    categories: CategoriesInputImp,
  ): Observable<Status> {
    return this.categoryHandler.saveMany(categories);
  }

  // TODO: update status
  @Mutation(() => Status)
  removeCategory(@Args('id') id: number): Observable<Status> {
    return this.categoryHandler.remove({ id: +id });
  }

  @Mutation(() => Status)
  removeCategories(): Observable<Status> {
    return this.categoryHandler.removeAll();
  }
}
