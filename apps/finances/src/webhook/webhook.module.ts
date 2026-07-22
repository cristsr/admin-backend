import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CategorizationRuleModule } from '../categorization-rule/categorization-rule.module';
import { MovementModule } from '../movement/movement.module';
import { ReceiveWebhookTransactionUsecase, ReverseWebhookTransactionUsecase } from './application/usecases';
import { WebhookController } from './infrastructure/adapters/http';

@Module({
  // The outbox is reached via MovementModule's RecordMovementService, not imported here.
  imports: [MovementModule, AccountModule, CategorizationRuleModule],
  controllers: [WebhookController],
  providers: [ReceiveWebhookTransactionUsecase, ReverseWebhookTransactionUsecase],
})
export class WebhookModule {}
