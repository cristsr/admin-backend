export class MovementReversalOutputDto {
  externalReference: string;

  originalMovementId: number;

  /** Id of the compensating movement that cancels the original. */
  reversalMovementId: number;
}
