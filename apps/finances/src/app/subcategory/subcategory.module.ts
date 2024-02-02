import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'app/category/category.module';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { SubcategoryRepository } from 'app/subcategory/repositories';
import { SubcategoryService } from 'app/subcategory/services';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);
const Repositories = [SubcategoryRepository];

@Module({
  imports: [Entities, forwardRef(() => CategoryModule)],
  controllers: [SubcategoryService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class SubcategoryModule {}
