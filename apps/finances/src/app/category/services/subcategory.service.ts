import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { SubcategoryHandler } from 'app/category/handlers';
import {
  CreateSubcategory,
  CreateSubcategories,
  Status,
  Subcategory,
  UpdateSubcategory,
  Subcategories,
  Id,
} from '@admin-back/grpc';

@GrpcService('finances')
export class SubcategoryService {
  constructor(private subcategoryHandler: SubcategoryHandler) {}

  @GrpcMethod()
  create(data: CreateSubcategory) {
    return this.subcategoryHandler.create(data);
  }

  @GrpcMethod()
  createMany(data: CreateSubcategories): Promise<Status> {
    return this.subcategoryHandler.createMany(data);
  }

  @GrpcMethod()
  async findAll(category: Id): Promise<Subcategories> {
    return this.subcategoryHandler.findAll(category.id);
  }

  @GrpcMethod()
  findOne(subcategory: Id): Promise<Subcategory> {
    return this.subcategoryHandler.findOne(subcategory.id);
  }

  @GrpcMethod()
  update(data: UpdateSubcategory): Promise<Subcategory> {
    return this.subcategoryHandler.update(data);
  }

  @GrpcMethod()
  async remove(subcategory: Id): Promise<Status> {
    return this.subcategoryHandler.remove(subcategory.id);
  }
}
