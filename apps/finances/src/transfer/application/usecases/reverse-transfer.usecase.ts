import { Injectable } from '@nestjs/common';
import { MovementRepository } from '@app/movement/domain/movement';
import {
  TransferAlreadyReversedException,
  TransferFactory,
  TransferNotFoundException,
} from '@app/transfer/domain';
import { TransferReversalOutputDto } from '../dto/transfer-reversal-output.dto';

/**
 * Cancels a transfer with a compensating reversal instead of deleting anything.
 * Idempotency without a new column: the compensating pair has its own transfer
 * group, so a second attempt finds it and fails with 409.
 */
@Injectable()
export class ReverseTransferUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly transferFactory: TransferFactory,
  ) {}

  async execute(
    transferGroup: string,
    user: number,
  ): Promise<TransferReversalOutputDto> {
    const legs = await this.movementRepository.findByTransferGroup(
      transferGroup,
      user,
    );
    if (!legs.length) {
      throw new TransferNotFoundException('Transfer not found');
    }

    const reversalGroup = TransferFactory.reversalGroupFor(transferGroup);
    const existing = await this.movementRepository.findByTransferGroup(
      reversalGroup,
      user,
    );
    if (existing.length) {
      throw new TransferAlreadyReversedException('Transfer already reversed');
    }

    const [out, into] = await this.movementRepository.saveAll(
      this.transferFactory.reversalOf(legs, transferGroup),
    );

    return {
      originalTransferGroup: transferGroup,
      reversalTransferGroup: reversalGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
    };
  }
}
