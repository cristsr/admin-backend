import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '@shared';
import {
  WebhookTransactionInputDto,
  WebhookTransactionOutputDto,
} from '../../../application/dto';
import { ReceiveWebhookTransactionUsecase } from '../../../application/usecases';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

@Controller('webhooks')
@Public()
@UseGuards(WebhookApiKeyGuard)
export class WebhookController {
  constructor(
    private readonly receiveWebhookTransactionUsecase: ReceiveWebhookTransactionUsecase,
  ) {}

  @Post('transactions')
  async receiveTransaction(
    @Body() input: WebhookTransactionInputDto,
  ): Promise<WebhookTransactionOutputDto> {
    return this.receiveWebhookTransactionUsecase.execute(input);
  }
}
