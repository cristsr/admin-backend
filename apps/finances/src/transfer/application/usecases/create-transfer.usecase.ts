import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AccountNotFoundException,
  AccountRepository,
} from '../../../account/domain/account';
import {
  Movement,
  MovementRepository,
  MovementSource,
  MovementType,
} from '../../../movement/domain/movement';
import {
  SameAccountTransferException,
  TransferCurrencyMismatchException,
} from '../../domain';
import { TransferInputDto } from '../dto/transfer-input.dto';
import { TransferOutputDto } from '../dto/transfer-output.dto';

/**
 * Moving money between the user's own accounts. It is recorded as two linked
 * movements (TRANSFER_OUT on the source, TRANSFER_IN on the destination) that
 * share a transfer group, rather than as a loose expense plus a loose income
 * that the reports would count as real spending and earning.
 */
@Injectable()
export class CreateTransferUsecase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(
    input: TransferInputDto,
    user: number,
  ): Promise<TransferOutputDto> {
    if (input.from === input.to) {
      throw new SameAccountTransferException(
        'Cannot transfer to the same account',
      );
    }

    const [from, to] = await Promise.all([
      this.accountRepository.findByIdAndUser(input.from, user),
      this.accountRepository.findByIdAndUser(input.to, user),
    ]);

    if (!from) {
      throw new AccountNotFoundException('Source account not found');
    }

    if (!to) {
      throw new AccountNotFoundException('Destination account not found');
    }

    // Currency conversion does not exist yet, so a cross-currency transfer
    // would silently move a number that means something different on each
    // side. Refused until there are historical rates.
    if (from.currency !== to.currency) {
      throw new TransferCurrencyMismatchException(
        `Cannot transfer between accounts in ${from.currency} and ${to.currency}`,
      );
    }

    const transferGroup = randomUUID();
    const description = input.description ?? `Transfer ${from.name} → ${to.name}`;

    const leg = (type: MovementType, accountId: number) =>
      Movement.create({
        date: input.date,
        type,
        description,
        amount: input.amount,
        currency: input.currency,
        accountId,
        user,
        transferGroup,
        source: MovementSource.MANUAL,
      } as Movement);

    // Both legs in one transaction: half a transfer would make money vanish.
    const [out, into] = await this.movementRepository.saveAll([
      leg(MovementType.TRANSFER_OUT, from.id),
      leg(MovementType.TRANSFER_IN, to.id),
    ]);

    return {
      transferGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
    };
  }
}
