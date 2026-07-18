import { Injectable } from '@nestjs/common';
import {
  Movement,
  MovementRepository,
  MovementSource,
  MovementType,
} from '../../../movement/domain/movement';
import {
  TransferAlreadyReversedException,
  TransferNotFoundException,
} from '../../domain';
import { TransferReversalOutputDto } from '../dto/transfer-reversal-output.dto';

/**
 * Anula una transferencia con una reversa compensatoria: crea un par de
 * movimientos que compensan las patas originales (tipo invertido), sin borrar
 * nada. Idempotencia sin columna nueva: el par compensatorio usa
 * `reversal:{transferGroup}` como su propio transferGroup; un segundo intento
 * lo encuentra y falla con 409.
 */
@Injectable()
export class ReverseTransferUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

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

    const reversalGroup = `reversal:${transferGroup}`;
    const existing = await this.movementRepository.findByTransferGroup(
      reversalGroup,
      user,
    );
    if (existing.length) {
      throw new TransferAlreadyReversedException('Transfer already reversed');
    }

    const flip = (type: MovementType) =>
      type === MovementType.TRANSFER_OUT
        ? MovementType.TRANSFER_IN
        : MovementType.TRANSFER_OUT;

    const compensations = legs.map((leg) =>
      Movement.create({
        date: new Date(),
        type: flip(leg.type),
        description: `Reversal of transfer ${transferGroup}`,
        amount: leg.amount,
        currency: leg.currency,
        accountId: leg.accountId,
        user,
        transferGroup: reversalGroup,
        source: MovementSource.MANUAL,
      } as Movement),
    );

    const [out, into] = await this.movementRepository.saveAll(compensations);

    return {
      originalTransferGroup: transferGroup,
      reversalTransferGroup: reversalGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
    };
  }
}
