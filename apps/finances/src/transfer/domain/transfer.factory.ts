import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Account } from '@app/account/domain/account';
import { ExchangeRateProvider } from '@app/exchange/domain';
import { Movement, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { TransferCommand } from './transfer-command.type';
import { SameAccountTransferException } from './transfer.exception';

const REVERSAL_PREFIX = 'reversal:';

/** The two legs of a transfer and the applied rate. */
export class TransferPair {
  constructor(
    readonly transferGroup: string,
    readonly out: Movement,
    readonly into: Movement,
    readonly exchangeRate: number,
  ) {}

  legs(): Movement[] {
    return [this.out, this.into];
  }
}

/**
 * Builds the two linked legs of a transfer; they are not expense/income, so
 * reports know to skip them.
 */
@Injectable()
export class TransferFactory {
  constructor(private readonly exchangeRateProvider: ExchangeRateProvider) {}

  /** Cross-currency legs are converted with the rate of the transfer's own date. */
  async pair(command: TransferCommand): Promise<TransferPair> {
    const { from, to, amount, date } = command;

    if (from.id === to.id) {
      throw new SameAccountTransferException('Cannot transfer to the same account');
    }

    const exchangeRate = await this.rateBetween(from, to, date);
    const credited = amount.convertTo(to.currencyCode(), exchangeRate);

    const transferGroup = randomUUID();
    const description = command.description ?? `Transfer ${from.name} → ${to.name}`;

    const leg = (type: MovementType, accountId: number, money: Money) =>
      Movement.transferLeg({
        date,
        type,
        description,
        money,
        accountId,
        user: from.user,
        transferGroup,
      });

    return new TransferPair(
      transferGroup,
      leg(MovementType.TRANSFER_OUT, from.id, amount),
      leg(MovementType.TRANSFER_IN, to.id, credited),
      exchangeRate,
    );
  }

  /**
   * Compensating movements that cancel a transfer; filed under the reversal's
   * own group, which makes a second attempt detectable.
   */
  reversalOf(legs: Movement[], transferGroup: string): Movement[] {
    const reversalGroup = TransferFactory.reversalGroupFor(transferGroup);
    const description = `Reversal of transfer ${transferGroup}`;

    return legs.map((leg) => leg.reversalLeg(reversalGroup, description));
  }

  static reversalGroupFor(transferGroup: string): string {
    return `${REVERSAL_PREFIX}${transferGroup}`;
  }

  private async rateBetween(from: Account, to: Account, date: Date): Promise<number> {
    if (from.currencyCode() === to.currencyCode()) return 1;

    return this.exchangeRateProvider.getRate(from.currencyCode(), to.currencyCode(), date);
  }
}
