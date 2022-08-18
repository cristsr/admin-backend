import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  Category,
  CATEGORY_SERVICE,
  CategoryGrpc,
  CreateCategories,
  CreateCategory,
  Status,
  UpdateCategory,
} from '@admin-back/grpc';

@Resolver()
export class CategoryResolver {
  @Inject(CATEGORY_SERVICE)
  private categoryService: CategoryGrpc;

  @Query(() => Category)
  getCategory(@Args('id') id: number) {
    return this.categoryService.findOne({ id: +id });
  }

  @Query(() => [Category])
  getCategories(): Observable<Category[]> {
    return this.categoryService.findAll().pipe(map((res) => res.data));
  }

  @Mutation(() => Category)
  createCategory(
    @Args('category')
    category: CreateCategory
  ): Observable<Category> {
    return this.categoryService.create(category);
  }

  @Mutation(() => Status)
  createCategories(
    @Args('categories')
    categories: CreateCategories
  ): Observable<Status> {
    return this.categoryService.createMany(categories);
  }

  @Mutation(() => Category)
  updateCategory(
    @Args('category')
    category: UpdateCategory
  ): Observable<Category> {
    return this.categoryService.update(category);
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
