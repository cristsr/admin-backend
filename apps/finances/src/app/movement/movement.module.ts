import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { AccountModule } from 'app/account/account.module';
import { MovementEntity } from 'app/movement/entities';
import { MovementRepository } from 'app/movement/repositories';
import { MovementService } from 'app/movement/services';

const Entities = TypeOrmModule.forFeature([MovementEntity]);
const Repositories = [MovementRepository];

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule, AccountModule],
  controllers: [MovementService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class MovementModule {}
