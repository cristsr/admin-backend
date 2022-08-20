import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { MovementService } from 'app/movement/services';
import { MovementHandler } from 'app/movement/handlers';
import { MovementEntity } from 'app/movement/entities';

const Entities = TypeOrmModule.forFeature([MovementEntity]);

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule],
  controllers: [MovementService],
  providers: [MovementHandler],
  exports: [Entities],
})
export class MovementModule {}
