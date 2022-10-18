import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { CategoryEntity } from 'app/category/entities';
import { CategoryService } from 'app/category/services';

const Entities = TypeOrmModule.forFeature([CategoryEntity]);

@Module({
  imports: [Entities, SubcategoryModule],
  controllers: [CategoryService],
  exports: [Entities],
})
export class CategoryModule {}
