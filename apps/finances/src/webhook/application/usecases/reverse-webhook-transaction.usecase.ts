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
 * Revierte un movimiento originado por webhook mal reconciliado creando un
 * movimiento compensatorio (tipo invertido), sin borrar el original. Idempotente
 * sin columna nueva: la reversa usa `reversal:{externalReference}` como su
 * propio externalReference; una segunda llamada la encuentra y devuelve el
 * mismo resultado sin duplicar.
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
