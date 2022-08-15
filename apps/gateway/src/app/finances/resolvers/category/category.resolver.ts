import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Category, CATEGORY_SERVICE, CategoryService } from '@admin-back/grpc';
import { map } from 'rxjs';

@Resolver()
export class CategoryResolver {
  @Inject(CATEGORY_SERVICE)
  private categoryService: CategoryService;

  @Query(() => Category)
  getCategory(@Args('id') id: number) {
    return this.categoryService.findOne({ id: +id });
  }

  @Query(() => [Category])
  getCategories() {
    return this.categoryService.findAll().pipe(map((res) => res.data));
  }

  // @Mutation(() => CategoryDto)
}
