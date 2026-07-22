import { Injectable } from '@nestjs/common';
import { AccountLookups, AccountNotFoundException, AccountRepository } from '@app/account/domain/account';
import { CategoryResolver } from '@app/categorization-rule/domain/categorization-rule';
import { RecordMovementService } from '@app/movement/application/services';
import { Movement, MovementLookups, MovementRepository, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { WebhookTransactionOutputDto } from '../dto/webhook-transaction-output.dto';

@Injectable()
export class ReceiveWebhookTransactionUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryResolver: CategoryResolver,
    private readonly recordMovement: RecordMovementService,
  ) {}

  /** `requestId` is a fallback; the telemetry trace in context wins when present. */
  async execute(input: WebhookTransactionInputDto, requestId?: string): Promise<WebhookTransactionOutputDto> {
    const existing = await this.movementRepository.firstMatching(
      MovementLookups.byExternalReference(input.externalReference),
    );

    if (existing) {
      return {
        movementId: existing.id,
        externalReference: input.externalReference,
        duplicate: true,
      };
    }

    // Categories come as names; when absent, the user's categorization rules decide.
    const { categoryId, subcategoryId } = await this.categoryResolver.resolveByNames(
      { category: input.category, subcategory: input.subcategory },
      { merchant: input.merchant, description: input.merchant },
      input.user,
    );

    const account = await this.accountRepository.firstMatching(
      AccountLookups.byIdAndUser(input.account, input.user),
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

    const saved = await this.recordMovement.record(movement, account, {
      requestId,
    });

    return {
      movementId: saved.id,
      externalReference: input.externalReference,
      duplicate: false,
    };
  }
}
