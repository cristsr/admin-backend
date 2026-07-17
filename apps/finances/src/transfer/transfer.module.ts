import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { MovementModule } from '../movement/movement.module';
import { CreateTransferUsecase } from './application/usecases';
import { TransferController } from './infrastructure/adapters/http';

/**
 * A transfer owns no table: it is recorded as a linked pair of movements, so
 * this module only orchestrates the account and movement ports.
 */
@Module({
  imports: [AccountModule, MovementModule],
  controllers: [TransferController],
  providers: [CreateTransferUsecase],
})
export class TransferModule {}
