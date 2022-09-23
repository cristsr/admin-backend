import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { ScheduledHandler } from 'app/scheduled/handlers';
import { ScheduledService } from 'app/scheduled/services';
import { ScheduledEntity } from 'app/scheduled/entities';

const Entities = TypeOrmModule.forFeature([ScheduledEntity]);

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule],
  controllers: [ScheduledService],
  providers: [ScheduledHandler],
  exports: [Entities],
})
export class ScheduledModule {}
