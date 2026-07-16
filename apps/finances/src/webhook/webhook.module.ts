import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CategoryModule } from '../category/category.module';
import { MovementModule } from '../movement/movement.module';
import { WebhookController } from './infrastructure/adapters/http';
import { ReceiveWebhookTransactionUsecase } from './application/usecases';

@Module({
  imports: [CategoryModule, MovementModule, AccountModule],
  controllers: [WebhookController],
  providers: [ReceiveWebhookTransactionUsecase],
})
export class WebhookModule {}
