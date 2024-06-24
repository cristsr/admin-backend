import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { CATEGORY_HANDLER, CategoryHandler, Status } from '@admin-back/core';
import {
  CategoriesInputImp,
  CategoryImp,
  CategoryInputImp,
} from 'app/finances/category/dto/category.dto';

@Resolver(CategoryImp)
export class CategoryResolver {
  constructor(
    @Inject(CATEGORY_HANDLER)
    private categoryService: CategoryHandler
  ) {}

  @Query(() => CategoryImp)
  category(user, @Args('id') id: number) {
    return this.categoryService.findOne({ id: +id });
  }

  @Query(() => [CategoryImp])
  categories(): Observable<CategoryImp[]> {
    return this.categoryService.findAll();
  }

  @Mutation(() => CategoryImp)
  saveCategory(
    @Args('category')
    category: CategoryInputImp
  ): Observable<CategoryImp> {
    return this.categoryService.save(category);
  }

  @Mutation(() => Status)
  saveCategories(
    @Args('categories')
    categories: CategoriesInputImp
  ): Observable<Status> {
    return this.categoryService.saveMany(categories);
  }

  // TODO: update status
  @Mutation(() => Status)
  removeCategory(@Args('id') id: number): Observable<Status> {
    return this.categoryService.remove({ id: +id });
  }

  @Mutation(() => Status)
  removeCategories(): Observable<Status> {
    return this.categoryService.removeAll();
  }
}
