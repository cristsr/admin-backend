import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  Id,
  SUBCATEGORY_HANDLER,
  Status,
  SubcategoriesInput,
  Subcategory,
  SubcategoryHandler,
  SubcategoryInput,
} from '@core';
import { Observable } from 'rxjs';
import { SubcategoryService } from 'app/subcategory/services';

@Controller()
export class SubcategoryController implements SubcategoryHandler {
  constructor(private subcategoryService: SubcategoryService) {}

  @GrpcMethod(SUBCATEGORY_HANDLER)
  findOne(subcategoryId: Id): Observable<Subcategory> {
    return this.subcategoryService.findOne(subcategoryId);
  }

  @GrpcMethod(SUBCATEGORY_HANDLER)
  findByCategory(categoryId: Id): Observable<Subcategory[]> {
    return this.subcategoryService.findByCategory(categoryId);
  }

  @GrpcMethod(SUBCATEGORY_HANDLER)
  save(data: SubcategoryInput): Observable<Subcategory> {
    return this.subcategoryService.save(data);
  }

  @GrpcMethod(SUBCATEGORY_HANDLER)
  saveMany(input: SubcategoriesInput): Observable<Status> {
    return this.subcategoryService.saveMany(input);
  }

  @GrpcMethod(SUBCATEGORY_HANDLER)
  remove(subcategoryId: Id): Observable<Status> {
    return this.subcategoryService.remove(subcategoryId);
  }
}
