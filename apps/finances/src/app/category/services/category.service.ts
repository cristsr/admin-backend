import {
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { CategoryHandler } from 'app/category/handlers';
import { CreateSubcategoryPipe } from 'app/category/pipes';
import { CreateSubcategoryDto, UpdateCategoryDto } from 'app/category/dto';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  Empty,
  Id,
  Categories,
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
} from '@admin-back/grpc';

@GrpcService('finances')
export class CategoryService {
  constructor(private readonly categoryHandler: CategoryHandler) {}

  @GrpcMethod()
  create(data: CreateCategory) {
    console.log(data);
    return this.categoryHandler.create(data);
  }

  @GrpcMethod()
  createMany({ data }: CreateCategories): Promise<any> {
    return this.categoryHandler.createMany(data);
  }

  @GrpcMethod()
  async findAll(): Promise<Categories> {
    return this.categoryHandler.findAll();
  }

  @GrpcMethod()
  findOne({ id }): Promise<Category> {
    return this.categoryHandler.findOne(id);
  }

  @GrpcMethod()
  update(data: UpdateCategory): Promise<Category> {
    return this.categoryHandler.update(data.id, data);
  }

  @GrpcMethod()
  remove({ id }: Id): Promise<Empty> {
    return this.categoryHandler.remove(id);
  }

  @GrpcMethod()
  removeAll(): Promise<any> {
    return this.categoryHandler.removeAll();
  }

  @Post('/:id/subcategories')
  createSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Body(CreateSubcategoryPipe)
    createSubcategoryDto: CreateSubcategoryDto[]
  ) {
    return this.categoryHandler.createSubcategories(
      category,
      createSubcategoryDto
    );
  }

  @Get(':id/subcategories')
  findSubcategories(@Param('id', ParseIntPipe) id: number) {
    return this.categoryHandler.findSubcategories(id);
  }

  @Get(':id/subcategories/:idSub')
  findSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number
  ) {
    return this.categoryHandler.findSubcategory(category, subcategory);
  }

  @Put(':id/subcategories/:idSub')
  updateSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number,
    @Body() updateSubcategoryDto: UpdateCategoryDto
  ) {
    return this.categoryHandler.updateSubcategory(
      category,
      subcategory,
      updateSubcategoryDto
    );
  }

  @Delete(':id/subcategories/:idSub')
  removeSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number
  ) {
    return this.categoryHandler.removeSubcategory(category, subcategory);
  }
}
