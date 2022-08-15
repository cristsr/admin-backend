import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryHandler } from 'app/category/handlers';
import { CategoryService } from 'app/category/services';
import { CategoryEntity, SubcategoryEntity } from 'app/category/entities';

const entities = TypeOrmModule.forFeature([CategoryEntity, SubcategoryEntity]);

@Module({
  imports: [entities],
  controllers: [CategoryService],
  providers: [ValidationPipe, CategoryHandler],
  exports: [entities],
})
export class CategoryModule {}
