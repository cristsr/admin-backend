import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from 'app/category/controllers';
import { CategoryEntity } from 'app/category/entities';
import { CategoryRepository } from 'app/category/repositories';
import { CategoryService } from 'app/category/services';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

const Entities = TypeOrmModule.forFeature([CategoryEntity]);
const Repositories = [CategoryRepository];

@Module({
  imports: [Entities, SubcategoryModule],
  controllers: [CategoryController],
  providers: [...Repositories, CategoryService],
  exports: [...Repositories],
})
export class CategoryModule {}
