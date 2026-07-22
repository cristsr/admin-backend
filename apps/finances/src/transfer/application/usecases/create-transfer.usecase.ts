import { Injectable } from '@nestjs/common';
import {
  Account,
  AccountLookups,
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { MovementRepository } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { TransferFactory } from '@app/transfer/domain';
import { TransferInputDto } from '../dto/transfer-input.dto';
import { TransferOutputDto } from '../dto/transfer-output.dto';

/**
 * Moves money between the user's own accounts as two linked movements sharing
 * a transfer group, so reports don't count it as spending and earning.
 */
@Injectable()
export class CreateTransferUsecase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly movementRepository: MovementRepository,
    private readonly transferFactory: TransferFactory,
  ) {}

  async execute(input: TransferInputDto, user: number): Promise<TransferOutputDto> {
    const [from, to] = await Promise.all([
      this.accountRepository.firstMatching(AccountLookups.byIdAndUser(input.from, user)),
      this.accountRepository.firstMatching(AccountLookups.byIdAndUser(input.to, user)),
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

  /** The account decides; the live balance it needs is only known by the repository. */
  private async ensureSourceCanFund(from: Account, amount: Money, user: number): Promise<void> {
    if (from.allowNegativeBalance) return;

    const movementBalance = await this.accountRepository.movementBalance(from.id, user);

    from.ensureCanWithdraw(amount, movementBalance);
  }
}
