import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryRepository } from './domain/category';
import { SubcategoryRepository } from './domain/subcategory';
import { CategoryController, SubcategoryController } from './infrastructure/adapters/http';
import {
  TypeOrmCategoryEntity,
  TypeOrmCategoryRepository,
} from './infrastructure/adapters/persistence/typeorm/category';
import {
  TypeOrmSubcategoryEntity,
  TypeOrmSubcategoryRepository,
} from './infrastructure/adapters/persistence/typeorm/subcategory';
import {
  FindAllCategoriesUsecase,
  FindCategoryUsecase,
  FindSubcategoriesByCategoryUsecase,
  FindSubcategoryUsecase,
  GetTaxonomyUsecase,
  RemoveCategoryUsecase,
  RemoveSubcategoryUsecase,
  SaveCategoryUsecase,
  SaveManyCategoriesUsecase,
  SaveManySubcategoriesUsecase,
  SaveSubcategoryUsecase,
} from './application/usecases';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmCategoryEntity, TypeOrmSubcategoryEntity]),
  ],
  controllers: [CategoryController, SubcategoryController],
  providers: [
    { provide: CategoryRepository, useClass: TypeOrmCategoryRepository },
    { provide: SubcategoryRepository, useClass: TypeOrmSubcategoryRepository },
    FindCategoryUsecase,
    FindAllCategoriesUsecase,
    SaveCategoryUsecase,
    SaveManyCategoriesUsecase,
    RemoveCategoryUsecase,
    FindSubcategoryUsecase,
    FindSubcategoriesByCategoryUsecase,
    SaveSubcategoryUsecase,
    SaveManySubcategoriesUsecase,
    RemoveSubcategoryUsecase,
    GetTaxonomyUsecase,
  ],
  exports: [CategoryRepository, SubcategoryRepository],
})
export class CategoryModule {}
