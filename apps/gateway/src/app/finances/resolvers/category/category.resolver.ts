import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  Category,
  CATEGORY_SERVICE,
  CategoryService,
  CreateCategory,
} from '@admin-back/grpc';
import { map, Observable } from 'rxjs';

@Resolver()
export class CategoryResolver {
  @Inject(CATEGORY_SERVICE)
  private categoryService: CategoryService;

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
    @Args('category') category: CreateCategory
  ): Observable<Category> {
    console.log(category);
    return this.categoryService.create(category);
  }
}
