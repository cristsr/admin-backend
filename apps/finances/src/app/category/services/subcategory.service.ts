import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { SubcategoryHandler } from 'app/category/handlers';
import {
  SubcategoryGrpc,
  CreateSubcategory,
  CreateSubcategories,
  Status,
  Subcategory,
  UpdateSubcategory,
  Subcategories,
  Id,
} from '@admin-back/grpc';

@GrpcService('finances')
export class SubcategoryService implements SubcategoryGrpc {
  constructor(private subcategoryHandler: SubcategoryHandler) {}

  @GrpcMethod()
  findOne(subcategory: Id): Observable<Subcategory> {
    return this.subcategoryHandler.findOne(subcategory.id);
  }

  @GrpcMethod()
  findByCategory(category: Id): Observable<Subcategories> {
    return this.subcategoryHandler.findAll(category.id);
  }

  @GrpcMethod()
  create(data: CreateSubcategory): Observable<Subcategory> {
    return this.subcategoryHandler.create(data);
  }

  @GrpcMethod()
  createMany(data: CreateSubcategories): Observable<Status> {
    return this.subcategoryHandler.createMany(data);
  }

  @GrpcMethod()
  update(data: UpdateSubcategory): Observable<Subcategory> {
    return this.subcategoryHandler.update(data);
  }

  @GrpcMethod()
  remove(subcategory: Id): Observable<Status> {
    return this.subcategoryHandler.remove(subcategory.id);
  }
}
