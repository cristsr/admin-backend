import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity, SubcategoryEntity } from 'app/category/entities';
import { CategoryHandler, SubcategoryHandler } from 'app/category/handlers';
import { CategoryService, SubcategoryService } from 'app/category/services';

const entities = TypeOrmModule.forFeature([CategoryEntity, SubcategoryEntity]);

@Module({
  imports: [entities],
  controllers: [CategoryService, SubcategoryService],
  providers: [ValidationPipe, CategoryHandler, SubcategoryHandler],
  exports: [entities],
})
export class CategoryModule {}
