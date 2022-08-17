import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { CategoryHandler } from 'app/category/handlers';
import {
  Id,
  Categories,
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
  Status,
} from '@admin-back/grpc';

@GrpcService('finances')
export class CategoryService {
  constructor(private categoryHandler: CategoryHandler) {}

  @GrpcMethod()
  create(data: CreateCategory) {
    return this.categoryHandler.create(data);
  }

  @GrpcMethod()
  createMany(categories: CreateCategories): Promise<Status> {
    return this.categoryHandler.createMany(categories.data);
  }

  @GrpcMethod()
  async findAll(): Promise<Categories> {
    return this.categoryHandler.findAll();
  }

  @GrpcMethod()
  findOne(category: Id): Promise<Category> {
    return this.categoryHandler.findOne(category.id);
  }

  @GrpcMethod()
  update(category: UpdateCategory): Promise<Category> {
    return this.categoryHandler.update(category);
  }

  @GrpcMethod()
  remove(category: Id): Promise<Status> {
    return this.categoryHandler.remove(category.id);
  }

  @GrpcMethod()
  removeAll(): Promise<Status> {
    return this.categoryHandler.removeAll();
  }
}
