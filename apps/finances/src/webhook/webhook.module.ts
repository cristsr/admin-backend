import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CategoryModule } from '../category/category.module';
import { MovementModule } from '../movement/movement.module';
import { WebhookController } from './infrastructure/adapters/http';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from './application/usecases';

@Module({
  imports: [CategoryModule, MovementModule, AccountModule],
  controllers: [WebhookController],
  providers: [
    ReceiveWebhookTransactionUsecase,
    ReverseWebhookTransactionUsecase,
  ],
})
export class WebhookModule {}
