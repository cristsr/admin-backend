export class ConsolidatedAccountBalanceDto {
  accountId: number;

  currency: string;

  /** Saldo en la moneda de la cuenta. */
  balance: number;

  /** Mismo saldo convertido a la moneda de presentación. */
  balanceInPresentationCurrency: number;
}

export class ConsolidatedBalanceOutputDto {
  /** Moneda de presentación del usuario (claim del JWT). */
  presentationCurrency: string;

  /** Saldo consolidado de todas las cuentas en la moneda de presentación. */
  total: number;

  /** Ingresos consolidados en moneda de presentación. */
  incomes: number;

  /** Gastos consolidados en moneda de presentación. */
  expenses: number;

  accounts: ConsolidatedAccountBalanceDto[];
}
