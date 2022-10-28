import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { ScheduledService } from 'app/scheduled/services';
import { ScheduledEntity } from 'app/scheduled/entities';
import { AccountModule } from 'app/account/account.module';

const Entities = TypeOrmModule.forFeature([ScheduledEntity]);

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule, AccountModule],
  controllers: [ScheduledService],
  exports: [Entities],
})
export class ScheduledModule {}
