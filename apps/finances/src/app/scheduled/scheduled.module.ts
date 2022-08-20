import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

import { ScheduledService } from 'app/scheduled/services';
import { ScheduledController } from 'app/scheduled/controllers';
import { ScheduledEntity } from 'app/scheduled/entities';

const Entities = TypeOrmModule.forFeature([ScheduledEntity]);

@Module({
  imports: [Entities, CategoryModule, SubcategoryModule],
  controllers: [ScheduledController],
  providers: [ScheduledService],
  exports: [Entities],
})
export class ScheduledModule {}
