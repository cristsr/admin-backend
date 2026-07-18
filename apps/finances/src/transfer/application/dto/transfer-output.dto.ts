export class TransferOutputDto {
  /** Shared by both legs; use it to fetch the pair. */
  transferGroup: string;

  fromMovementId: number;

  toMovementId: number;

  /** Monto debitado del origen, en la moneda del origen. */
  amount: number;

  currency: string;

  /** Monto acreditado en el destino (= amount * exchangeRate). */
  toAmount: number;

  /** Moneda del destino. */
  toCurrency: string;

  /** Tasa aplicada origen→destino (1 si es la misma moneda). */
  exchangeRate: number;

  date: Date;
}
