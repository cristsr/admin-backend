export class MovementReversalOutputDto {
  externalReference: string;

  originalMovementId: number;

  /** Id del movimiento compensatorio que anula el original. */
  reversalMovementId: number;
}
