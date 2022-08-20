import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { CategoryEntity } from 'app/category/entities';
import { CategoryHandler } from 'app/category/handlers';
import { CategoryService } from 'app/category/services';

const Entities = TypeOrmModule.forFeature([CategoryEntity]);

@Module({
  imports: [Entities, SubcategoryModule],
  controllers: [CategoryService],
  providers: [CategoryHandler],
  exports: [Entities],
})
export class CategoryModule {}
