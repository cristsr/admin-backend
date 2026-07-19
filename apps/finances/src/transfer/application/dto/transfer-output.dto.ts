export class TransferOutputDto {
  /** Shared by both legs; use it to fetch the pair. */
  transferGroup: string;

  fromMovementId: number;

  toMovementId: number;

  /** Amount debited from the source, in the source currency. */
  amount: number;

  currency: string;

  /** Amount credited to the destination (= amount * exchangeRate). */
  toAmount: number;

  /** Destination currency. */
  toCurrency: string;

  /** Rate applied source→destination (1 if it is the same currency). */
  exchangeRate: number;

  date: Date;
}
