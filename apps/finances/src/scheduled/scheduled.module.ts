import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module';
import { CategoryModule } from '../category/category.module';
import { MovementModule } from '../movement/movement.module';
import { ScheduledRepository } from './domain/scheduled';
import { GenerateScheduledMovementsEventHandler } from './infrastructure/adapters/events';
import { ScheduledController } from './infrastructure/adapters/http';
import {
  TypeOrmScheduledEntity,
  TypeOrmScheduledRepository,
} from './infrastructure/adapters/persistence/typeorm/scheduled';
import { ScheduledScheduler } from './infrastructure/adapters/schedulers';
import {
  FindAllScheduledUsecase,
  FindScheduledUsecase,
  GenerateScheduledMovementsUsecase,
  RemoveScheduledUsecase,
  SaveScheduledUsecase,
} from './application/usecases';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmScheduledEntity]),
    CategoryModule,
    AccountModule,
    MovementModule,
  ],
  controllers: [ScheduledController],
  providers: [
    { provide: ScheduledRepository, useClass: TypeOrmScheduledRepository },
    FindScheduledUsecase,
    FindAllScheduledUsecase,
    SaveScheduledUsecase,
    RemoveScheduledUsecase,
    GenerateScheduledMovementsUsecase,
    ScheduledScheduler,
    GenerateScheduledMovementsEventHandler,
  ],
  exports: [ScheduledRepository],
})
export class ScheduledModule {}
