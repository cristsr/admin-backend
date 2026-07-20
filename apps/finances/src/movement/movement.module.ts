import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module';
import { CategorizationRuleModule } from '../categorization-rule/categorization-rule.module';
import { CategoryModule } from '../category/category.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RecordMovementService } from './application/services';
import {
  FindAllMovementsUsecase,
  FindMovementUsecase,
  RemoveMovementUsecase,
  SaveMovementUsecase,
  UpdateMovementUsecase,
} from './application/usecases';
import { MovementRepository } from './domain/movement';
import { MovementController } from './infrastructure/adapters/http';
import {
  TypeOrmMovementEntity,
  TypeOrmMovementRepository,
} from './infrastructure/adapters/persistence/typeorm/movement';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmMovementEntity]),
    CategoryModule,
    AccountModule,
    OutboxModule,
    IdempotencyModule,
    CategorizationRuleModule,
  ],
  controllers: [MovementController],
  providers: [
    { provide: MovementRepository, useClass: TypeOrmMovementRepository },
    RecordMovementService,
    FindMovementUsecase,
    FindAllMovementsUsecase,
    SaveMovementUsecase,
    UpdateMovementUsecase,
    RemoveMovementUsecase,
  ],
  // Exported so every module records movements through the same rules.
  exports: [MovementRepository, RecordMovementService],
})
export class MovementModule {}
