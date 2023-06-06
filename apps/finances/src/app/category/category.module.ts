import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { CategoryEntity } from 'app/category/entities';
import { CategoryService } from 'app/category/services';
import { CategoryRepository } from 'app/category/repositories';

const Entities = TypeOrmModule.forFeature([CategoryEntity]);
const Repositories = [CategoryRepository];

@Module({
  imports: [Entities, SubcategoryModule],
  controllers: [CategoryService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class CategoryModule {}
