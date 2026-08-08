/** Reads a single assertion's reconciliation status. */
export class GetAssertionStatusQuery {
  constructor(
    readonly userId: string,
    readonly assertionId: string,
  ) {}
}
