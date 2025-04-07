import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from 'app/modules/category/controllers';
import { CategoryEntity } from 'app/modules/category/entities';
import { CategoryRepository } from 'app/modules/category/repositories';
import { CategoryService } from 'app/modules/category/services';
import { SubcategoryModule } from 'app/modules/subcategory/subcategory.module';

const Entities = TypeOrmModule.forFeature([CategoryEntity]);
const Repositories = [CategoryRepository];

@Module({
  imports: [Entities, SubcategoryModule],
  controllers: [CategoryController],
  providers: [...Repositories, CategoryService],
  exports: [...Repositories],
})
export class CategoryModule {}
