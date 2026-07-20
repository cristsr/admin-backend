export class TransferOutputDto {
  transferGroup: string;

  fromMovementId: number;

  toMovementId: number;

  amount: number;

  currency: string;

  toAmount: number;

  toCurrency: string;

  exchangeRate: number;

  date: Date;
}
