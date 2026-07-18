import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module';
import { TypeOrmCategoryEntity } from '../category/infrastructure/adapters/persistence/typeorm/category';
import { ExchangeModule } from '../exchange/exchange.module';
import { TypeOrmMovementEntity } from '../movement/infrastructure/adapters/persistence/typeorm/movement';
import { SummaryRepository } from './domain/summary';
import { SummaryController } from './infrastructure/adapters/http';
import { TypeOrmSummaryRepository } from './infrastructure/adapters/persistence/typeorm/summary';
import {
  GetBalanceUsecase,
  GetConsolidatedBalanceUsecase,
  GetExpensesUsecase,
  GetLastMovementsUsecase,
} from './application/usecases';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmMovementEntity, TypeOrmCategoryEntity]),
    AccountModule,
    ExchangeModule,
  ],
  controllers: [SummaryController],
  providers: [
    { provide: SummaryRepository, useClass: TypeOrmSummaryRepository },
    GetBalanceUsecase,
    GetConsolidatedBalanceUsecase,
    GetExpensesUsecase,
    GetLastMovementsUsecase,
  ],
})
export class SummaryModule {}
