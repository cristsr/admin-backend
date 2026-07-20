import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Account } from '@app/account/domain/account';
import { ExchangeRateProvider } from '@app/exchange/domain';
import { Movement, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { SameAccountTransferException } from './transfer.exception';

/** Prefix that turns a transfer group into the group of its compensating pair. */
const REVERSAL_PREFIX = 'reversal:';

export interface TransferCommand {
  from: Account;
  to: Account;
  amount: Money;
  date: Date;
  description?: string;
}

/**
 * The two movements a transfer is made of, plus what the conversion cost. Both
 * legs share a group so either one can be reached from the other.
 */
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
 * Builds the movements that represent moving money between a user's own
 * accounts. A transfer is deliberately not an expense plus an income — money
 * the user already had did not become spending by changing account — so it is
 * recorded as two linked legs the reports know to skip.
 */
@Injectable()
export class TransferFactory {
  constructor(private readonly exchangeRateProvider: ExchangeRateProvider) {}

  /**
   * Cross-currency transfers are converted with the rate of the transfer's own
   * date (AC-2); when there is none, the provider refuses rather than guessing.
   */
  async pair(command: TransferCommand): Promise<TransferPair> {
    const { from, to, amount, date } = command;

    if (from.id === to.id) {
      throw new SameAccountTransferException(
        'Cannot transfer to the same account',
      );
    }

    const exchangeRate = await this.rateBetween(from, to, date);
    const credited = amount.convertTo(to.currencyCode(), exchangeRate);

    const transferGroup = randomUUID();
    const description =
      command.description ?? `Transfer ${from.name} → ${to.name}`;

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
   * The compensating movements that cancel an existing transfer. Nothing is
   * deleted: the original legs stay, offset by an inverted pair filed under the
   * reversal's own group, which is also what makes a second attempt detectable.
   */
  reversalOf(legs: Movement[], transferGroup: string): Movement[] {
    const reversalGroup = TransferFactory.reversalGroupFor(transferGroup);
    const description = `Reversal of transfer ${transferGroup}`;

    return legs.map((leg) => leg.reversalLeg(reversalGroup, description));
  }

  static reversalGroupFor(transferGroup: string): string {
    return `${REVERSAL_PREFIX}${transferGroup}`;
  }

  private async rateBetween(
    from: Account,
    to: Account,
    date: Date,
  ): Promise<number> {
    if (from.currencyCode() === to.currencyCode()) return 1;

    return this.exchangeRateProvider.getRate(
      from.currencyCode(),
      to.currencyCode(),
      date,
    );
  }
}
