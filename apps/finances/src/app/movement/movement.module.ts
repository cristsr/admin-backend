import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { MovementService } from 'app/movement/services';
import { MovementEntity } from 'app/movement/entities';
import { AccountModule } from 'app/account/account.module';

const Entities = TypeOrmModule.forFeature([MovementEntity]);

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule, AccountModule],
  controllers: [MovementService],
  exports: [Entities],
})
export class MovementModule {}
