/** Result of declaring an assertion: its id and the reached stream position. */
export interface AssertBalanceOutputDto {
  readonly assertionId: string;
  readonly streamPosition: number;
}
