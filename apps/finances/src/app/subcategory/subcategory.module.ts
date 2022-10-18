import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { SubcategoryService } from 'app/subcategory/services';
import { CategoryModule } from 'app/category/category.module';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);

@Module({
  imports: [Entities, forwardRef(() => CategoryModule)],
  controllers: [SubcategoryService],
  exports: [Entities],
})
export class SubcategoryModule {}
