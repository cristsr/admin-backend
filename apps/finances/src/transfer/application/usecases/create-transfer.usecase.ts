import { Injectable } from '@nestjs/common';
import {
  Account,
  AccountCriteria,
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { MovementRepository } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { TransferFactory } from '@app/transfer/domain';
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
    private readonly transferFactory: TransferFactory,
  ) {}

  async execute(
    input: TransferInputDto,
    user: number,
  ): Promise<TransferOutputDto> {
    const [from, to] = await Promise.all([
      this.accountRepository.firstMatching(
        AccountCriteria.byIdAndUser(input.from, user),
      ),
      this.accountRepository.firstMatching(
        AccountCriteria.byIdAndUser(input.to, user),
      ),
    ]);

    if (!from) {
      throw new AccountNotFoundException('Source account not found');
    }

    if (!to) {
      throw new AccountNotFoundException('Destination account not found');
    }

    const amount = Money.of(input.amount, from.currencyCode());

    await this.ensureSourceCanFund(from, amount, user);

    const transfer = await this.transferFactory.pair({
      from,
      to,
      amount,
      date: input.date,
      description: input.description,
    });

    // Both legs in one transaction: half a transfer would make money vanish.
    const [out, into] = await this.movementRepository.saveAll(transfer.legs());

    return {
      transferGroup: transfer.transferGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
      amount: transfer.out.money.amount,
      currency: transfer.out.money.currency,
      toAmount: transfer.into.money.amount,
      toCurrency: transfer.into.money.currency,
      exchangeRate: transfer.exchangeRate,
      date: input.date,
    };
  }

  /**
   * AC-1: the account decides whether it can fund the transfer; the live
   * balance it needs for that is the one thing only the repository knows.
   */
  private async ensureSourceCanFund(
    from: Account,
    amount: Money,
    user: number,
  ): Promise<void> {
    if (from.allowNegativeBalance) return;

    const movementBalance = await this.accountRepository.movementBalance(
      from.id,
      user,
    );

    from.ensureCanWithdraw(amount, movementBalance);
  }
}
