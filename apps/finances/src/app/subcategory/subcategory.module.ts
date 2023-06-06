import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { SubcategoryService } from 'app/subcategory/services';
import { CategoryModule } from 'app/category/category.module';
import { SubcategoryRepository } from 'app/subcategory/repositories';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);
const Repositories = [SubcategoryRepository];

@Module({
  imports: [Entities, forwardRef(() => CategoryModule)],
  controllers: [SubcategoryService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class SubcategoryModule {}
