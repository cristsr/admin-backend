import { Injectable } from '@nestjs/common';
import {
  Movement,
  MovementNotFoundException,
  MovementRepository,
  MovementSource,
  MovementType,
} from '../../../movement/domain/movement';
import { MovementReversalOutputDto } from '../dto';

/**
 * Reverses a movement created by a mis-reconciled webhook by creating a
 * compensating movement (inverted type), without deleting the original.
 * Idempotent without a new column: the reversal uses
 * `reversal:{externalReference}` as its own externalReference; a second call
 * finds it and returns the same result without duplicating.
 */
@Injectable()
export class ReverseWebhookTransactionUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(
    externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    const original =
      await this.movementRepository.findByExternalReference(externalReference);
    if (!original) {
      throw new MovementNotFoundException('Transaction not found');
    }

    const reversalReference = `reversal:${externalReference}`;
    const existing =
      await this.movementRepository.findByExternalReference(reversalReference);
    if (existing) {
      return {
        externalReference,
        originalMovementId: original.id,
        reversalMovementId: existing.id,
      };
    }

    const flip = (type: MovementType) =>
      type === MovementType.EXPENSE
        ? MovementType.INCOME
        : MovementType.EXPENSE;

    const compensation = Movement.create({
      date: new Date(),
      type: flip(original.type),
      description: `Reversal of ${externalReference}`,
      amount: original.amount,
      currency: original.currency,
      categoryId: original.categoryId,
      subcategoryId: original.subcategoryId,
      accountId: original.accountId,
      user: original.user,
      source: MovementSource.WEBHOOK,
      externalReference: reversalReference,
    } as Movement);

    const saved = await this.movementRepository.save(compensation);

    return {
      externalReference,
      originalMovementId: original.id,
      reversalMovementId: saved.id,
    };
  }
}
