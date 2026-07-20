import { Injectable } from '@nestjs/common';
import {
  MovementCriteria,
  MovementNotFoundException,
  MovementRepository,
} from '@app/movement/domain/movement';
import { MovementReversalOutputDto } from '../dto';

/**
 * Reverses a webhook movement via a compensating movement keyed
 * `reversal:{externalReference}`, so retries return the same reversal.
 */
@Injectable()
export class ReverseWebhookTransactionUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(
    externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    const original = await this.movementRepository.firstMatching(
      MovementCriteria.byExternalReference(externalReference),
    );
    if (!original) {
      throw new MovementNotFoundException('Transaction not found');
    }

    const reversalReference = `reversal:${externalReference}`;
    const existing = await this.movementRepository.firstMatching(
      MovementCriteria.byExternalReference(reversalReference),
    );
    if (existing) {
      return {
        externalReference,
        originalMovementId: original.id,
        reversalMovementId: existing.id,
      };
    }

    const saved = await this.movementRepository.save(
      original.reversal(reversalReference),
    );

    return {
      externalReference,
      originalMovementId: original.id,
      reversalMovementId: saved.id,
    };
  }
}
