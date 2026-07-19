import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MovementModule } from '../movement/movement.module';
import {
  CreateTransferUsecase,
  ReverseTransferUsecase,
} from './application/usecases';
import { TransferController } from './infrastructure/adapters/http';

/**
 * A transfer owns no table: it is recorded as a linked pair of movements, so
 * this module only orchestrates the account, movement and exchange-rate ports.
 */
@Module({
  imports: [AccountModule, MovementModule, ExchangeModule, IdempotencyModule],
  controllers: [TransferController],
  providers: [CreateTransferUsecase, ReverseTransferUsecase],
})
export class TransferModule {}
