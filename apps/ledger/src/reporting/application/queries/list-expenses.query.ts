export class ListExpensesQuery {
  constructor(
    readonly userId: string,
    readonly startDate: string,
    readonly endDate: string,
  ) {}
}
