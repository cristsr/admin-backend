import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/modules/account/account.module';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementModule } from 'app/modules/movement/movement.module';
import { ScheduledController } from 'app/modules/scheduled/controllers';
import { ScheduledEntity } from 'app/modules/scheduled/entities';
import { ScheduledRepository } from 'app/modules/scheduled/repositories';
import { ScheduledService } from 'app/modules/scheduled/services';
import { SubcategoryModule } from 'app/modules/subcategory/subcategory.module';

const Entities = TypeOrmModule.forFeature([ScheduledEntity]);
const Repositories = [ScheduledRepository];

@Module({
  imports: [
    Entities,
    CategoryModule,
    SubcategoryModule,
    AccountModule,
    MovementModule,
  ],
  controllers: [ScheduledController],
  providers: [...Repositories, ScheduledService],
  exports: [...Repositories],
})
export class ScheduledModule {}
