export class ConsolidatedAccountBalanceDto {
  accountId: number;

  currency: string;

  /** Balance in the account's own currency. */
  balance: number;

  /** Same balance converted to the presentation currency. */
  balanceInPresentationCurrency: number;
}

export class ConsolidatedBalanceOutputDto {
  /** User's presentation currency (JWT claim). */
  presentationCurrency: string;

  /** Consolidated balance of all accounts in the presentation currency. */
  total: number;

  /** Consolidated incomes in the presentation currency. */
  incomes: number;

  /** Consolidated expenses in the presentation currency. */
  expenses: number;

  accounts: ConsolidatedAccountBalanceDto[];
}
