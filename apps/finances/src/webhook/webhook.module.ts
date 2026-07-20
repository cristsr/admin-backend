import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CategorizationRuleModule } from '../categorization-rule/categorization-rule.module';
import { MovementModule } from '../movement/movement.module';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from './application/usecases';
import { WebhookController } from './infrastructure/adapters/http';

@Module({
  // The outbox is reached through MovementModule's RecordMovementService now,
  // so this module no longer knows that recording a movement emits an event.
  imports: [MovementModule, AccountModule, CategorizationRuleModule],
  controllers: [WebhookController],
  providers: [
    ReceiveWebhookTransactionUsecase,
    ReverseWebhookTransactionUsecase,
  ],
})
export class WebhookModule {}
