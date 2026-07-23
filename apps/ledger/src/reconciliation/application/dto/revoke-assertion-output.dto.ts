/** Result of revoking an assertion: its id and the reached stream position. */
export interface RevokeAssertionOutputDto {
  readonly assertionId: string;
  readonly streamPosition: bigint;
}
