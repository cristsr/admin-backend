import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared';
import {
  MovementReversalOutputDto,
  WebhookTransactionInputDto,
  WebhookTransactionOutputDto,
} from '@app/webhook/application/dto';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from '@app/webhook/application/usecases';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

@ApiTags('webhooks')
@ApiSecurity('webhookApiKey')
@Controller('webhooks')
@Public()
@UseGuards(WebhookApiKeyGuard)
@Throttle({ webhook: { limit: 60, ttl: 60_000 } })
export class WebhookController {
  constructor(
    private readonly receiveWebhookTransactionUsecase: ReceiveWebhookTransactionUsecase,
    private readonly reverseWebhookTransactionUsecase: ReverseWebhookTransactionUsecase,
  ) {}

  @Post('transactions')
  async receiveTransaction(
    @Body() input: WebhookTransactionInputDto,
    @Req() req: { id?: string },
  ): Promise<WebhookTransactionOutputDto> {
    // `req.id` is the correlation id pino attaches from X-Request-Id.
    return this.receiveWebhookTransactionUsecase.execute(input, req.id);
  }

  @Post('transactions/:externalReference/reversal')
  async reverseTransaction(
    @Param('externalReference') externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    return this.reverseWebhookTransactionUsecase.execute(externalReference);
  }
}
