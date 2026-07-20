export class ConsolidatedAccountBalanceDto {
  accountId: number;

  currency: string;

  balance: number;

  balanceInPresentationCurrency: number;
}

export class ConsolidatedBalanceOutputDto {
  presentationCurrency: string;

  total: number;

  incomes: number;

  expenses: number;

  accounts: ConsolidatedAccountBalanceDto[];
}
