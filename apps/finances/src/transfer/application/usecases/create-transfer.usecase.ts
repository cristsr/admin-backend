import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AccountNotFoundException,
  AccountRepository,
} from '../../../account/domain/account';
import { ExchangeRateProvider } from '../../../exchange/domain';
import {
  Movement,
  MovementRepository,
  MovementSource,
  MovementType,
} from '../../../movement/domain/movement';
import {
  InsufficientBalanceException,
  SameAccountTransferException,
} from '../../domain';
import { TransferInputDto } from '../dto/transfer-input.dto';
import { TransferOutputDto } from '../dto/transfer-output.dto';

/**
 * Moving money between the user's own accounts. It is recorded as two linked
 * movements (TRANSFER_OUT on the source, TRANSFER_IN on the destination) that
 * share a transfer group, rather than as a loose expense plus a loose income
 * that the reports would count as real spending and earning.
 *
 * Cross-currency: the user provides the amount in the source currency; the
 * destination is computed with the `exchanges` rate at the given date (AC-2).
 * If there is no rate, the provider throws ExchangeRateUnavailableException
 * (422).
 */
@Injectable()
export class CreateTransferUsecase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly movementRepository: MovementRepository,
    private readonly exchangeRateProvider: ExchangeRateProvider,
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

    // AC-1: reject only when the source forbids going negative and the live
    // balance (initialBalance + signed movements) cannot cover the amount.
    if (!from.allowNegativeBalance) {
      const movementBalance = await this.accountRepository.movementBalance(
        from.id,
        user,
      );
      const liveBalance = (from.initialBalance ?? 0) + movementBalance;
      if (liveBalance - input.amount < 0) {
        throw new InsufficientBalanceException(
          `Account ${from.id} has insufficient balance for this transfer`,
        );
      }
    }

    let exchangeRate = 1;
    let toAmount = input.amount;
    if (from.currency !== to.currency) {
      exchangeRate = await this.exchangeRateProvider.getRate(
        from.currency,
        to.currency,
        input.date,
      );
      toAmount = Math.round(input.amount * exchangeRate * 100) / 100;
    }

    const transferGroup = randomUUID();
    const description =
      input.description ?? `Transfer ${from.name} → ${to.name}`;

    const leg = (
      type: MovementType,
      accountId: number,
      amount: number,
      currency: string,
    ) =>
      Movement.create({
        date: input.date,
        type,
        description,
        amount,
        currency,
        accountId,
        user,
        transferGroup,
        source: MovementSource.MANUAL,
      } as Movement);

    // Both legs in one transaction: half a transfer would make money vanish.
    const [out, into] = await this.movementRepository.saveAll([
      leg(MovementType.TRANSFER_OUT, from.id, input.amount, from.currency),
      leg(MovementType.TRANSFER_IN, to.id, toAmount, to.currency),
    ]);

    return {
      transferGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
      amount: input.amount,
      currency: from.currency,
      toAmount,
      toCurrency: to.currency,
      exchangeRate,
      date: input.date,
    };
  }
}
