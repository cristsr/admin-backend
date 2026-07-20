import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { CategoryResolver } from '@app/categorization-rule/domain/categorization-rule';
import { currentTraceId } from '@app/config/telemetry/correlation';
import { MovementSaved, MovementSavedPayload } from '@app/movement/application/movement.constants';
import {
  Movement,
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';
import { DomainEventOutboxPublisher } from '@app/outbox/application/services/domain-event-outbox.publisher';
import { Money } from '@app/shared/domain';
import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { WebhookTransactionOutputDto } from '../dto/webhook-transaction-output.dto';

/**
 * AC-4 (sm-0004): the webhook path enqueues `movement.saved` in the outbox with
 * the correlation id pulled from the incoming request, so the trace crosses the
 * request → cron boundary and reaches the `BudgetThresholdExceeded` handler
 * with the same id.
 */
@Injectable()
export class ReceiveWebhookTransactionUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryResolver: CategoryResolver,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
  ) {}

  /**
   * `requestId` is only a fallback: when telemetry is on, the trace id in
   * context wins — and it already reflects any `traceparent` the caller sent,
   * so the provider's own trace continues into ours.
   */
  async execute(
    input: WebhookTransactionInputDto,
    requestId?: string,
  ): Promise<WebhookTransactionOutputDto> {
    const correlationId = currentTraceId() ?? requestId;

    const existing = await this.movementRepository.findByExternalReference(
      input.externalReference,
    );

    if (existing) {
      return {
        movementId: existing.id,
        externalReference: input.externalReference,
        duplicate: true,
      };
    }

    // The provider names its categories, so they are resolved by name; when it
    // sends none, the user's categorization rules decide (AC-4).
    const { categoryId, subcategoryId } =
      await this.categoryResolver.resolveByNames(
        { category: input.category, subcategory: input.subcategory },
        { merchant: input.merchant, description: input.merchant },
        input.user,
      );

    const account = await this.accountRepository.findByIdAndUser(
      input.account,
      input.user,
    );

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const movement = Movement.fromWebhook({
      date: input.date,
      type: input.type ?? MovementType.EXPENSE,
      description: input.merchant,
      merchant: input.merchant,
      money: Money.of(input.amount, input.currency),
      paymentMethod: input.paymentMethod,
      categoryId,
      subcategoryId,
      accountId: account.id,
      user: input.user,
      externalReference: input.externalReference,
      invoiceNumber: input.invoiceNumber,
      invoiceIssuer: input.invoiceIssuer,
      invoiceUrl: input.invoiceUrl,
      invoiceIssuedAt: input.invoiceIssuedAt,
    });

    // The movement and its domain event commit together; the relay re-emits
    // movement.saved later so the budget flow runs even across a crash.
    const saved = await this.movementRepository.runInTransaction(
      async (manager) => {
        const persisted = await this.movementRepository.saveWithManager(
          manager,
          movement,
        );

        await this.outboxPublisher.publish(manager, {
          eventType: MovementSaved,
          payload: {
            categoryId: persisted.categoryId,
            accountId: persisted.accountId,
            date: persisted.date,
            amount: persisted.money.amount,
            user: persisted.user,
            correlationId,
          } as MovementSavedPayload,
        });

        return persisted;
      },
    );

    return {
      movementId: saved.id,
      externalReference: input.externalReference,
      duplicate: false,
    };
  }
}
