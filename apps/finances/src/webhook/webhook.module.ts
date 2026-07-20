import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CategorizationRuleModule } from '../categorization-rule/categorization-rule.module';
import { MovementModule } from '../movement/movement.module';
import { OutboxModule } from '../outbox/outbox.module';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from './application/usecases';
import { WebhookController } from './infrastructure/adapters/http';

@Module({
  imports: [
    MovementModule,
    AccountModule,
    CategorizationRuleModule,
    OutboxModule,
  ],
  controllers: [WebhookController],
  providers: [
    ReceiveWebhookTransactionUsecase,
    ReverseWebhookTransactionUsecase,
  ],
})
export class WebhookModule {}
