export class ExpenseLineItemDto {
  constructor(
    readonly date: Date,
    readonly description: string,
    readonly category: string,
    readonly amount: string,
    readonly currency: string,
  ) {}
}

export class ExpenseReportDto {
  constructor(
    readonly items: ExpenseLineItemDto[],
    readonly totalByCategory: Record<string, string>,
    readonly presentationCurrency: string,
  ) {}
}
