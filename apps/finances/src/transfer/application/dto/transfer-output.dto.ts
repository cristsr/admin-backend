export class TransferOutputDto {
  /** Shared by both legs; use it to fetch the pair. */
  transferGroup: string;

  fromMovementId: number;

  toMovementId: number;

  amount: number;

  currency: string;

  date: Date;
}
