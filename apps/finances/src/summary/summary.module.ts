import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmCategoryEntity } from '../category/infrastructure/adapters/persistence/typeorm/category';
import { TypeOrmMovementEntity } from '../movement/infrastructure/adapters/persistence/typeorm/movement';
import { SummaryRepository } from './domain/summary';
import { SummaryController } from './infrastructure/adapters/http';
import { TypeOrmSummaryRepository } from './infrastructure/adapters/persistence/typeorm/summary';
import {
  GetBalanceUsecase,
  GetExpensesUsecase,
  GetLastMovementsUsecase,
} from './application/usecases';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmMovementEntity, TypeOrmCategoryEntity]),
  ],
  controllers: [SummaryController],
  providers: [
    { provide: SummaryRepository, useClass: TypeOrmSummaryRepository },
    GetBalanceUsecase,
    GetExpensesUsecase,
    GetLastMovementsUsecase,
  ],
})
export class SummaryModule {}
