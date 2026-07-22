import { Injectable } from '@nestjs/common';
import { MovementReports, MovementRepository } from '@app/movement/domain/movement';
import {
  TransferAlreadyReversedException,
  TransferFactory,
  TransferNotFoundException,
} from '@app/transfer/domain';
import { TransferReversalOutputDto } from '../dto/transfer-reversal-output.dto';

/**
 * Cancels a transfer with a compensating pair instead of deleting; the pair's
 * own transfer group makes a second attempt fail with 409.
 */
@Injectable()
export class ReverseTransferUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly transferFactory: TransferFactory,
  ) {}

  async execute(transferGroup: string, user: number): Promise<TransferReversalOutputDto> {
    const legs = await this.movementRepository.matching(MovementReports.byTransferGroup(transferGroup, user));
    if (!legs.length) {
      throw new TransferNotFoundException('Transfer not found');
    }

    const reversalGroup = TransferFactory.reversalGroupFor(transferGroup);
    const existing = await this.movementRepository.countMatching(
      MovementReports.byTransferGroup(reversalGroup, user),
    );
    if (existing) {
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
