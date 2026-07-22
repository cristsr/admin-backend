import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MovementModule } from '../movement/movement.module';
import { CreateTransferUsecase, ReverseTransferUsecase } from './application/usecases';
import { TransferFactory } from './domain';
import { TransferController } from './infrastructure/adapters/http';

@Module({
  imports: [AccountModule, MovementModule, ExchangeModule, IdempotencyModule],
  controllers: [TransferController],
  providers: [TransferFactory, CreateTransferUsecase, ReverseTransferUsecase],
})
export class TransferModule {}
