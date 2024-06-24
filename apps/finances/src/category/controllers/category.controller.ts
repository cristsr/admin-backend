import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  CATEGORY_HANDLER,
  CategoriesInput,
  Category,
  CategoryHandler,
  CategoryInput,
  Id,
  Status,
} from '@admin-back/core';
import { CategoryService } from 'app/category/services';

@Controller('finances')
export class CategoryController implements CategoryHandler {
  constructor(private categoryService: CategoryService) {}

  @GrpcMethod(CATEGORY_HANDLER)
  findOne(categoryId: Id): Observable<Category> {
    return this.categoryService.findOne(categoryId);
  }

  @GrpcMethod(CATEGORY_HANDLER)
  findAll(): Observable<Category[]> {
    return this.categoryService.findAll();
  }

  @GrpcMethod(CATEGORY_HANDLER)
  save(input: CategoryInput): Observable<Category> {
    return this.categoryService.save(input);
  }

  @GrpcMethod(CATEGORY_HANDLER)
  saveMany(input: CategoriesInput): Observable<Status> {
    return this.categoryService.saveMany(input);
  }

  @GrpcMethod(CATEGORY_HANDLER)
  remove(category: Id): Observable<Status> {
    return this.categoryService.remove(category);
  }

  @GrpcMethod(CATEGORY_HANDLER)
  removeAll(): Observable<Status> {
    return this.categoryService.removeAll();
  }
}
