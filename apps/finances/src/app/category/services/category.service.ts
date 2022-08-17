import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { CategoryHandler } from 'app/category/handlers';
import {
  CategoryGrpc,
  Categories,
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
  Status,
  Id,
} from '@admin-back/grpc';
import { Observable } from 'rxjs';

@GrpcService('finances')
export class CategoryService implements CategoryGrpc {
  constructor(private categoryHandler: CategoryHandler) {}

  @GrpcMethod()
  create(data: CreateCategory): Observable<Category> {
    return this.categoryHandler.create(data);
  }

  @GrpcMethod()
  createMany(categories: CreateCategories): Observable<Status> {
    return this.categoryHandler.createMany(categories.data);
  }

  @GrpcMethod()
  findAll(): Observable<Categories> {
    return this.categoryHandler.findAll();
  }

  @GrpcMethod()
  findOne(category: Id): Observable<Category> {
    return this.categoryHandler.findOne(category.id);
  }

  @GrpcMethod()
  update(category: UpdateCategory): Observable<Category> {
    return this.categoryHandler.update(category);
  }

  @GrpcMethod()
  remove(category: Id): Observable<Status> {
    return this.categoryHandler.remove(category.id);
  }

  @GrpcMethod()
  removeAll(): Observable<Status> {
    return this.categoryHandler.removeAll();
  }
}
