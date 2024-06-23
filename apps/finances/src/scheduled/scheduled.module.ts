import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/account/account.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { ScheduledEntity } from 'app/scheduled/entities';
import { ScheduledRepository } from 'app/scheduled/repositories';
import { ScheduledService } from 'app/scheduled/services';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';


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
  controllers: [ScheduledService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class ScheduledModule {}
