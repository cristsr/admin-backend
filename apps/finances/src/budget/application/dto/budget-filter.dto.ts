export class UserBudgetFilterDto {
  budget: number;
}

export class BudgetFilterDto {
  startDate: Date;

  endDate: Date;

  account: number;

  limit?: number;

  offset?: number;
}
