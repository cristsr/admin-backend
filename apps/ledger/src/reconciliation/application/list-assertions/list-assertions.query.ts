/** Lists the reconciliation status of every assertion on an account. */
export class ListAssertionsQuery {
  constructor(
    readonly userId: string,
    readonly accountId: string,
  ) {}
}
