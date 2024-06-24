import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'app/category/category.module';
import { SubcategoryController } from 'app/subcategory/controllers';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { SubcategoryRepository } from 'app/subcategory/repositories';
import { SubcategoryService } from 'app/subcategory/services';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);
const Repositories = [SubcategoryRepository];

@Module({
  imports: [Entities, forwardRef(() => CategoryModule)],
  controllers: [SubcategoryController],
  providers: [...Repositories, SubcategoryService],
  exports: [...Repositories],
})
export class SubcategoryModule {}
