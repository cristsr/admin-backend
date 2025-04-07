import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'app/modules/category/category.module';
import { SubcategoryController } from 'app/modules/subcategory/controllers';
import { SubcategoryEntity } from 'app/modules/subcategory/entities';
import { SubcategoryRepository } from 'app/modules/subcategory/repositories';
import { SubcategoryService } from 'app/modules/subcategory/services';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);
const Repositories = [SubcategoryRepository];

@Module({
  imports: [Entities, forwardRef(() => CategoryModule)],
  controllers: [SubcategoryController],
  providers: [...Repositories, SubcategoryService],
  exports: [...Repositories],
})
export class SubcategoryModule {}
