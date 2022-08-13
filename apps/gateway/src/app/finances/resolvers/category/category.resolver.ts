import { Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { CATEGORY_SERVICE, CategoryService } from '@admin-back/grpc';

@Resolver()
export class CategoryResolver {
  @Inject(CATEGORY_SERVICE)
  private categoryService: CategoryService;
}
