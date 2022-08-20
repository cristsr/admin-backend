import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { SubcategoryService } from 'app/subcategory/services';
import { SubcategoryHandler } from 'app/subcategory/handlers';

const Entities = TypeOrmModule.forFeature([SubcategoryEntity]);

@Module({
  imports: [Entities],
  controllers: [SubcategoryService],
  providers: [SubcategoryHandler],
  exports: [Entities],
})
export class SubcategoryModule {}
