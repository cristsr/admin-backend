import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  Category,
  CATEGORY_SERVICE,
  CategoryGrpc,
  CategoriesInput,
  CategoryInput,
  Status,
} from '@admin-back/grpc';

@Resolver(Category)
export class CategoryResolver {
  constructor(
    @Inject(CATEGORY_SERVICE)
    private categoryService: CategoryGrpc
  ) {}

  @Query(() => Category)
  category(@Args('id') id: number) {
    return this.categoryService.findOne({ id: +id });
  }

  @Query(() => [Category])
  categories(): Observable<Category[]> {
    return this.categoryService.findAll();
  }

  @Mutation(() => Category)
  saveCategory(
    @Args('category')
    category: CategoryInput
  ): Observable<Category> {
    return this.categoryService.save(category);
  }

  @Mutation(() => Status)
  saveCategories(
    @Args('categories')
    categories: CategoriesInput
  ): Observable<Status> {
    return this.categoryService.saveMany(categories);
  }

  @Mutation(() => Status)
  removeCategory(@Args('id') id: number): Observable<Status> {
    return this.categoryService.remove({ id: +id });
  }

  @Mutation(() => Status)
  removeCategories(): Observable<Status> {
    return this.categoryService.removeAll();
  }
}
