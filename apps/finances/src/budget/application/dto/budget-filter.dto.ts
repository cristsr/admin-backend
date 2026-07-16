export class UserBudgetFilterDto {
  budget: number;

  user: number;
}

export class BudgetFilterDto {
  startDate: Date;

  endDate: Date;

  account: number;

  limit?: number;

  offset?: number;

  user: number;
}
