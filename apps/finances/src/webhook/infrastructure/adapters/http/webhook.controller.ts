import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Public } from '@shared';
import {
  MovementReversalOutputDto,
  WebhookTransactionInputDto,
  WebhookTransactionOutputDto,
} from '../../../application/dto';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from '../../../application/usecases';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

@Controller('webhooks')
@Public()
@UseGuards(WebhookApiKeyGuard)
export class WebhookController {
  constructor(
    private readonly receiveWebhookTransactionUsecase: ReceiveWebhookTransactionUsecase,
    private readonly reverseWebhookTransactionUsecase: ReverseWebhookTransactionUsecase,
  ) {}

  @Post('transactions')
  async receiveTransaction(
    @Body() input: WebhookTransactionInputDto,
  ): Promise<WebhookTransactionOutputDto> {
    return this.receiveWebhookTransactionUsecase.execute(input);
  }

  @Post('transactions/:externalReference/reversal')
  async reverseTransaction(
    @Param('externalReference') externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    return this.reverseWebhookTransactionUsecase.execute(externalReference);
  }
}
